/**
 * Module that opens a Samsung TV's on-screen keyboard only when asked for.
 *
 * Tizen opens the keyboard as soon as a text field gets focus, so moving through a form
 * with the D-pad stops at every field. Here a focused text field stays read-only, which
 * keeps the keyboard closed and lets the D-pad move on, until OK (Enter) is pressed on it.
 * The keyboard's Done or Cancel, or Back, closes it again.
 * @module scripts/tvKeyboard
 */

import { isInteractiveElement } from './keyboardNavigation';

// Key codes Tizen sends for the keyboard's Done and Cancel, and the remote's Back
const KEY_DONE = 65376;
const KEY_CANCEL = 65385;
const KEY_BACK = 10009;

// el.dataset.tvKeyboard is 'closed' while we hold a field read-only, 'open' while typing
let opening = false;

function close(el) {
    el.readOnly = true;
    el.dataset.tvKeyboard = 'closed';
}

function open(el) {
    el.readOnly = false;
    // Tizen shows the keyboard when a field gets focus, so focus it again
    opening = true;
    try {
        el.blur();
        el.focus();
    } finally {
        opening = false;
    }
    el.dataset.tvKeyboard = 'open';
}

function onFocusIn(e) {
    const el = e.target;
    if (opening) {
        el.dataset.tvKeyboard = 'open';
    } else if (isInteractiveElement(el) && !el.disabled && !el.readOnly) {
        close(el);
    }
}

function onFocusOut(e) {
    const el = e.target;
    if (el.dataset?.tvKeyboard) {
        el.readOnly = false;
        delete el.dataset.tvKeyboard;
    }
}

// Before anything else: Done, Cancel and Back close the keyboard
function onKeyDownCapture(e) {
    const el = document.activeElement;
    if (el?.dataset?.tvKeyboard !== 'open') return;

    if (e.keyCode === KEY_DONE || e.keyCode === KEY_CANCEL) {
        close(el);
    } else if (e.keyCode === KEY_BACK || e.key === 'XF86Back') {
        // Back closes the keyboard and leaves focus on the field; Back again goes back
        close(el);
        e.preventDefault();
        e.stopImmediatePropagation();
    }
}

// After the page's own handlers, so a field can use OK itself (and cancel the default)
function onKeyDown(e) {
    const el = document.activeElement;
    if (e.defaultPrevented || el?.dataset?.tvKeyboard !== 'closed') return;
    if (e.keyCode !== 13 || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

    // OK opens the keyboard instead of submitting the form
    e.preventDefault();
    open(el);
}

export function enable() {
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('keydown', onKeyDownCapture, true);
    window.addEventListener('keydown', onKeyDown);
}

export default {
    enable
};
