import { Canvas } from "fabric";
/**
 * Override the initialize function for the _historyInit();
 */
Canvas.prototype.historyInit = function () {
  this._historyInit();
};

/**
 * Override the dispose function for the _historyDispose();
 */
Canvas.prototype.dispose = (function (originalFn) {
  return function (...args) {
    originalFn.call(this, ...args);
    this._historyDispose();
    return this;
  };
})(Canvas.prototype.dispose);

/**
 * Returns current state of the string of the canvas
 */
Canvas.prototype._historyNext = function () {
  return JSON.stringify(this.toDatalessObject(this.extraProps));
};

/**
 * Returns an object with fabricjs event mappings
 */
Canvas.prototype._historyEvents = function () {
  return {
    "object:added": this._historySaveAction,
    "object:removed": this._historySaveAction,
    "object:modified": this._historySaveAction,
    "object:skewing": this._historySaveAction,
  };
};

/**
 * Initialization of the plugin
 */
Canvas.prototype._historyInit = function () {
  this.historyUndo = [];
  this.historyRedo = [];
  this.extraProps = ["selectable", "editable"];
  this.historyNextState = this._historyNext();

  this.on(this._historyEvents());
};

/**
 * Remove the custom event listeners
 */
Canvas.prototype._historyDispose = function () {
  this.off(this._historyEvents());
};

/**
 * It pushes the state of the canvas into history stack
 */
Canvas.prototype._historySaveAction = function () {
  if (this.historyProcessing) return;

  const json = this.historyNextState;
  this.historyUndo.push(json);
  this.historyUndo = this.historyUndo.slice(-30);
  this.historyNextState = this._historyNext();
  this.fire("history:append", { json: json });
};

/**
 * Undo to latest history.
 * Pop the latest state of the history. Re-render.
 * Also, pushes into redo history.
 */
Canvas.prototype.undo = async function () {
  // The undo process will render the new states of the objects
  // Therefore, object:added and object:modified events will triggered again
  // To ignore those events, we are setting a flag.
  this.historyProcessing = true;

  const history = this.historyUndo.pop();
  if (history) {
    // Push the current state to the redo history
    this.historyRedo.push(this._historyNext());
    this.historyNextState = history;
    await this._loadHistory(history, "history:undo");
  } else {
    this.historyProcessing = false;
  }
};

/**
 * Redo to latest undo history.
 */
Canvas.prototype.redo = async function () {
  // The undo process will render the new states of the objects
  // Therefore, object:added and object:modified events will triggered again
  // To ignore those events, we are setting a flag.
  this.historyProcessing = true;
  const history = this.historyRedo.pop();
  if (history) {
    // Every redo action is actually a new action to the undo history
    this.historyUndo.push(this._historyNext());
    this.historyUndo = this.historyUndo.slice(-30);
    this.historyNextState = history;
    await this._loadHistory(history, "history:redo");
  } else {
    this.historyProcessing = false;
  }
};

Canvas.prototype._loadHistory = async function (history, event) {
  var that = this;

  await this.loadFromJSON(history);
  that.renderAll();
  that.fire(event);
  that.historyProcessing = false;
};

/**
 * Clear undo and redo history stacks
 */
Canvas.prototype.clearHistory = function () {
  this.historyUndo = [];
  this.historyRedo = [];
  this.fire("history:clear");
};

/**
 * Off the history
 */
Canvas.prototype.offHistory = function () {
  this.historyProcessing = true;
};

/**
 * On the history
 */
Canvas.prototype.onHistory = function () {
  this.historyProcessing = false;

  this._historySaveAction();
};
