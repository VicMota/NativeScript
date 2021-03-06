﻿import types = require("utils/types");
import * as cameraCommonModule from "./camera-common";
import * as imageSourceModule from "image-source";
import * as frameModule from "ui/frame";

class UIImagePickerControllerDelegateImpl extends NSObject implements UIImagePickerControllerDelegate {
    public static ObjCProtocols = [UIImagePickerControllerDelegate];

    static new(): UIImagePickerControllerDelegateImpl {
        return <UIImagePickerControllerDelegateImpl>super.new();
    }

    private _callback: (result?) => void;

    private _width: number;
    private _height: number;
    private _keepAspectRatio: boolean;

    public initWithCallback(callback: (result?) => void): UIImagePickerControllerDelegateImpl {
        this._callback = callback;
        return this;
    }

    public initWithCallbackAndOptions(callback: (result?) => void, options?): UIImagePickerControllerDelegateImpl {
        this._callback = callback;
        if (options) {
            this._width = options.width;
            this._height = options.height;

            this._keepAspectRatio = types.isNullOrUndefined(options.keepAspectRatio) ? true : options.keepAspectRatio;
        }
        return this;
    }

    imagePickerControllerDidFinishPickingMediaWithInfo(picker, info): void {
        if (info) {
            var source = info.valueForKey(UIImagePickerControllerOriginalImage);
            if (source) {
                var image = null;
                if (this._width || this._height) {
                    var newSize = null;
                    if (this._keepAspectRatio) {
                        var common: typeof cameraCommonModule = require("./camera-common");

                        var aspectSafeSize = common.getAspectSafeDimensions(source.size.width, source.size.height, this._width, this._height);
                        newSize = CGSizeMake(aspectSafeSize.width, aspectSafeSize.height);
                    }
                    else {
                        newSize = CGSizeMake(this._width, this._height);
                    }
                    UIGraphicsBeginImageContextWithOptions(newSize, false, 0.0);
                    source.drawInRect(CGRectMake(0, 0, newSize.width, newSize.height));
                    image = UIGraphicsGetImageFromCurrentImageContext();
                    UIGraphicsEndImageContext();
                }

                var imageSource: typeof imageSourceModule = require("image-source");

                var imageSourceResult = image ? imageSource.fromNativeSource(image) : imageSource.fromNativeSource(source);

                if (this._callback) {
                    this._callback(imageSourceResult);
                }
            }
        }
        picker.presentingViewController.dismissViewControllerAnimatedCompletion(true, null);
        listener = null;
    }

    imagePickerControllerDidCancel(picker): void {
        picker.presentingViewController.dismissViewControllerAnimatedCompletion(true, null);
        listener = null;
    }
}

var listener;

export var takePicture = function (options): Promise<any> {
    return new Promise((resolve, reject) => {
        listener = null;
        var imagePickerController = new UIImagePickerController();
        var reqWidth = 0;
        var reqHeight = 0;
        var keepAspectRatio = true;
        if (options) {
            reqWidth = options.width || 0;
            reqHeight = options.height || reqWidth;
            keepAspectRatio = types.isNullOrUndefined(options.keepAspectRatio) ? true : options.keepAspectRatio;
        }
        if (reqWidth && reqHeight) {
            listener = UIImagePickerControllerDelegateImpl.new().initWithCallbackAndOptions(resolve, { width: reqWidth, height: reqHeight, keepAspectRatio: keepAspectRatio });
        }
        else {
            listener = UIImagePickerControllerDelegateImpl.new().initWithCallback(resolve);
        }
        imagePickerController.delegate = listener;

        var sourceType = UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera;
        var mediaTypes = UIImagePickerController.availableMediaTypesForSourceType(sourceType);

        if (mediaTypes) {
            imagePickerController.mediaTypes = mediaTypes;
            imagePickerController.sourceType = sourceType;
        }

        imagePickerController.modalPresentationStyle = UIModalPresentationStyle.UIModalPresentationCurrentContext;

        var frame: typeof frameModule = require("ui/frame");

        var topMostFrame = frame.topmost();
        if (topMostFrame) {
            var viewController: UIViewController = topMostFrame.currentPage && topMostFrame.currentPage.ios;
            if (viewController) {
                viewController.presentViewControllerAnimatedCompletion(imagePickerController, true, null);
            }
        }
    });
}
