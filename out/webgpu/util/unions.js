/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export function standardizeExtent3D(v) {if (v instanceof Array) {var _v$, _v$2, _v$3;return { width: (_v$ = v[0]) !== null && _v$ !== void 0 ? _v$ : 1, height: (_v$2 = v[1]) !== null && _v$2 !== void 0 ? _v$2 : 1, depth: (_v$3 = v[2]) !== null && _v$3 !== void 0 ? _v$3 : 1 };
  } else {var _v$width, _v$height, _v$depth;
    return { width: (_v$width = v.width) !== null && _v$width !== void 0 ? _v$width : 1, height: (_v$height = v.height) !== null && _v$height !== void 0 ? _v$height : 1, depth: (_v$depth = v.depth) !== null && _v$depth !== void 0 ? _v$depth : 1 };
  }
}
//# sourceMappingURL=unions.js.map