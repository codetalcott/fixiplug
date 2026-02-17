/**
 * Shared DOM utilities for Fixi
 * @module core/utils/dom
 */

/**
 * Dispatch a custom fx: event on an element
 * @param {Element} el - Target element
 * @param {string} type - Event type (will be prefixed with 'fx:')
 * @param {Object} detail - Event detail object
 * @param {boolean} [bubble=true] - Whether event should bubble
 * @returns {boolean} Whether the event was not cancelled
 */
export const send = (el, type, detail, bubble = true) => {
  if (!el || typeof el.dispatchEvent !== 'function') return false;
  return el.dispatchEvent(new CustomEvent('fx:' + type, {
    detail,
    cancelable: true,
    bubbles: bubble,
    composed: true
  }));
};

/**
 * Get an attribute value from an element with a default fallback
 * @param {Element} el - Target element
 * @param {string} name - Attribute name
 * @param {*} [def] - Default value if attribute is missing (not present)
 * @returns {string|*} Attribute value or default
 */
export const attr = (el, name, def) => {
  const val = el.getAttribute(name);
  return val !== null ? val : def;
};

/**
 * Check if an element should be ignored (has fx-ignore ancestor)
 * @param {Element} el - Element to check
 * @returns {boolean} True if element should be ignored
 */
export const ignore = (el) => el.closest('[fx-ignore]') !== null;
