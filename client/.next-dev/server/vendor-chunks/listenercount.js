"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/listenercount";
exports.ids = ["vendor-chunks/listenercount"];
exports.modules = {

/***/ "(ssr)/./node_modules/listenercount/index.js":
/*!*********************************************!*\
  !*** ./node_modules/listenercount/index.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar listenerCount = (__webpack_require__(/*! events */ \"events\").listenerCount)\n// listenerCount isn't in node 0.10, so here's a basic polyfill\nlistenerCount = listenerCount || function (ee, event) {\n  var listeners = ee && ee._events && ee._events[event]\n  if (Array.isArray(listeners)) {\n    return listeners.length\n  } else if (typeof listeners === 'function') {\n    return 1\n  } else {\n    return 0\n  }\n}\n\nmodule.exports = listenerCount\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbGlzdGVuZXJjb3VudC9pbmRleC5qcyIsIm1hcHBpbmdzIjoiQUFBWTs7QUFFWixvQkFBb0IsMkRBQStCO0FBQ25EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBOztBQUVBIiwic291cmNlcyI6WyJDOlxcQ2hyaXN0IElDRlxcc29jaW93ZWJcXGNsaWVudFxcbm9kZV9tb2R1bGVzXFxsaXN0ZW5lcmNvdW50XFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCdcblxudmFyIGxpc3RlbmVyQ291bnQgPSByZXF1aXJlKCdldmVudHMnKS5saXN0ZW5lckNvdW50XG4vLyBsaXN0ZW5lckNvdW50IGlzbid0IGluIG5vZGUgMC4xMCwgc28gaGVyZSdzIGEgYmFzaWMgcG9seWZpbGxcbmxpc3RlbmVyQ291bnQgPSBsaXN0ZW5lckNvdW50IHx8IGZ1bmN0aW9uIChlZSwgZXZlbnQpIHtcbiAgdmFyIGxpc3RlbmVycyA9IGVlICYmIGVlLl9ldmVudHMgJiYgZWUuX2V2ZW50c1tldmVudF1cbiAgaWYgKEFycmF5LmlzQXJyYXkobGlzdGVuZXJzKSkge1xuICAgIHJldHVybiBsaXN0ZW5lcnMubGVuZ3RoXG4gIH0gZWxzZSBpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiAxXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIDBcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxpc3RlbmVyQ291bnRcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/listenercount/index.js\n");

/***/ })

};
;