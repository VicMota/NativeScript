﻿import {ContentView} from "ui/content-view";
import view = require("ui/core/view");
import dts = require("ui/page");
import styleScope = require("../styling/style-scope");
import {ActionBar} from "ui/action-bar";
import {DependencyObservable, PropertyMetadata, PropertyMetadataSettings, PropertyChangeData, Property, ValueSource} from "ui/core/dependency-observable";
import * as style from "../styling/style";
import * as fileSystemModule from "file-system";
import * as frameModule from "ui/frame";
import proxy = require("ui/core/proxy");

var fs: typeof fileSystemModule;
function ensureFS() {
    if (!fs) {
        fs = require("file-system");
    }
}

var frame: typeof frameModule;
function ensureFrame() {
    if (!frame) {
        frame = require("ui/frame");
    }
}

// on Android we explicitly set propertySettings to None because android will invalidate its layout (skip unnecessary native call).
var AffectsLayout = global.android ? PropertyMetadataSettings.None : PropertyMetadataSettings.AffectsLayout;

var backgroundSpanUnderStatusBarProperty = new Property("backgroundSpanUnderStatusBar", "Page", new proxy.PropertyMetadata(false, AffectsLayout));

var actionBarHiddenProperty = new Property("actionBarHidden", "Page", new proxy.PropertyMetadata(undefined, AffectsLayout));

function onActionBarHiddenPropertyChanged(data: PropertyChangeData) {
    var page = <Page>data.object;
    if (page.isLoaded) {
        page._updateActionBar(data.newValue);
    }
}

(<proxy.PropertyMetadata>actionBarHiddenProperty.metadata).onSetNativeValue = onActionBarHiddenPropertyChanged;

export class Page extends ContentView implements dts.Page {
    public static backgroundSpanUnderStatusBarProperty = backgroundSpanUnderStatusBarProperty;
    public static actionBarHiddenProperty = actionBarHiddenProperty;
    public static navigatingToEvent = "navigatingTo";
    public static navigatedToEvent = "navigatedTo";
    public static navigatingFromEvent = "navigatingFrom";
    public static navigatedFromEvent = "navigatedFrom";
    public static shownModallyEvent = "shownModally";
    public static showingModallyEvent = "showingModally";

    protected _closeModalCallback: Function;

    private _navigationContext: any;

    private _cssApplied: boolean;
    private _styleScope: styleScope.StyleScope = new styleScope.StyleScope();
    private _actionBar: ActionBar;

    private _modal: Page;

    constructor(options?: dts.Options) {
        super(options);
        this.actionBar = new ActionBar();
    }

    public onLoaded() {
        // The default style of the page should be white background
        this.style._setValue(style.backgroundColorProperty, "white", ValueSource.Inherited);

        this._applyCss();
        
        if (this.actionBarHidden !== undefined) {
            this._updateActionBar(this.actionBarHidden);
        }

        super.onLoaded();
    }

    get backgroundSpanUnderStatusBar(): boolean {
        return this._getValue(Page.backgroundSpanUnderStatusBarProperty);
    }

    set backgroundSpanUnderStatusBar(value: boolean) {
        this._setValue(Page.backgroundSpanUnderStatusBarProperty, value);
    }
    
    get actionBarHidden(): boolean {
        return this._getValue(Page.actionBarHiddenProperty);
    }

    set actionBarHidden(value: boolean) {
        this._setValue(Page.actionBarHiddenProperty, value);
    }

    public _updateActionBar(hidden: boolean) {
        //
    }

    get navigationContext(): any {
        return this._navigationContext;
    }

    get css(): string {
        if (this._styleScope) {
            return this._styleScope.css;
        }
        return undefined;
    }
    set css(value: string) {
        this._styleScope.css = value;
        this._refreshCss();
    }

    get actionBar(): ActionBar {
        return this._actionBar;
    }
    set actionBar(value: ActionBar) {
        if (!value) {
            throw new Error("ActionBar cannot be null or undefined.");
        }

        if (this._actionBar !== value) {
            if (this._actionBar) {
                this._actionBar.page = undefined;
                this._removeView(this._actionBar);
            }
            this._actionBar = value;
            this._actionBar.page = this;
            this._addView(this._actionBar);
        }
    }

    get page(): view.View {
        return this;
    }

    private _refreshCss(): void {
        if (this._cssApplied) {
            this._resetCssValues();
        }

        this._cssApplied = false;
        if (this.isLoaded) {
            this._applyCss();
        }
    }

    public addCss(cssString: string): void {
        this._addCssInternal(cssString, undefined);
    }

    private _addCssInternal(cssString: string, cssFileName: string): void {
        this._styleScope.addCss(cssString, cssFileName);
        this._refreshCss();
    }

    private _cssFiles = {};
    public addCssFile(cssFileName: string) {
        ensureFS();

        if (cssFileName.indexOf("~/") === 0) {
            cssFileName = fs.path.join(fs.knownFolders.currentApp().path, cssFileName.replace("~/", ""));
        }
        if (!this._cssFiles[cssFileName]) {
            if (fs.File.exists(cssFileName)) {
                var file = fs.File.fromPath(cssFileName);
                var text = file.readTextSync();
                if (text) {
                    this._addCssInternal(text, cssFileName);
                    this._cssFiles[cssFileName] = true;
                }
            }
        }
    }

    get frame(): frameModule.Frame {
        return <frameModule.Frame>this.parent;
    }

    private createNavigatedData(eventName: string, isBackNavigation: boolean): dts.NavigatedData {
        return {
            eventName: eventName,
            object: this,
            context: this.navigationContext,
            isBackNavigation: isBackNavigation
        };
    }

    public onNavigatingTo(context: any, isBackNavigation: boolean) {
        this._navigationContext = context;
        this.notify(this.createNavigatedData(Page.navigatingToEvent, isBackNavigation));
    }

    public onNavigatedTo(isBackNavigation: boolean) {
        this.notify(this.createNavigatedData(Page.navigatedToEvent, isBackNavigation));
    }

    public onNavigatingFrom(isBackNavigation: boolean) {
        this.notify(this.createNavigatedData(Page.navigatingFromEvent, isBackNavigation));
    }

    public onNavigatedFrom(isBackNavigation: boolean) {
        this.notify(this.createNavigatedData(Page.navigatedFromEvent, isBackNavigation));

        this._navigationContext = undefined;
    }

    public showModal() {
        ensureFrame();
        if (arguments.length === 0) {
            this._showNativeModalView(<any>frame.topmost().currentPage, undefined, undefined, true);
        } else {
            var moduleName: string = arguments[0];
            var context: any = arguments[1];
            var closeCallback: Function = arguments[2];
            var fullscreen: boolean = arguments[3];

            var page = frame.resolvePageFromEntry({ moduleName: moduleName });
            (<Page>page)._showNativeModalView(this, context, closeCallback, fullscreen);
        }
    }

    public closeModal() {
        if (this._closeModalCallback) {
            this._closeModalCallback.apply(undefined, arguments);
        }
    }

    public get modal(): Page {
        return this._modal;
    }

    public _addChildFromBuilder(name: string, value: any) {
        if (value instanceof ActionBar) {
            this.actionBar = value;
        }
        else {
            super._addChildFromBuilder(name, value);
        }
    }

    protected _showNativeModalView(parent: Page, context: any, closeCallback: Function, fullscreen?: boolean) {
        parent._modal = this;
        var that = this;
        this._closeModalCallback = function () {
            if (that._closeModalCallback) {
                that._closeModalCallback = null;
                that._hideNativeModalView(parent);
                if (typeof closeCallback === "function") {
                    closeCallback.apply(undefined, arguments);
                }
            }
        };
    }

    protected _hideNativeModalView(parent: Page) {
        parent._modal = undefined;
    }

    protected _raiseShownModallyEvent(parent: Page, context: any, closeCallback: Function) {
        this.notify({
            eventName: Page.shownModallyEvent,
            object: this,
            context: context,
            closeCallback: this._closeModalCallback
        });
    }

    protected _raiseShowingModallyEvent() {
        this.notify({
            eventName: Page.showingModallyEvent,
            object: this
        });
    }

    public _getStyleScope(): styleScope.StyleScope {
        return this._styleScope;
    }

    public _eachChildView(callback: (child: view.View) => boolean) {
        super._eachChildView(callback);

        callback(this.actionBar);
    }

    private _applyCss() {
        if (this._cssApplied) {
            return;
        }

        this._styleScope.ensureSelectors();

        var scope = this._styleScope;
        var checkSelectors = (view: view.View): boolean => {
            scope.applySelectors(view);
            return true;
        }

        checkSelectors(this);
        view.eachDescendant(this, checkSelectors);

        this._cssApplied = true;
    }

    private _resetCssValues() {
        var resetCssValuesFunc = (view: view.View): boolean => {
            view.style._resetCssValues();
            return true;
        }

        resetCssValuesFunc(this);
        view.eachDescendant(this, resetCssValuesFunc);
    }
}
