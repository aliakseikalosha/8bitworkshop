
var vm = require('vm');
var fs = require('fs');
var assert = require('assert');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

includeInThisContext("src/util.js");
includeInThisContext("src/pixed/pixeleditor.js");

describe('Pixel editor', function() {
  it('Should decode', function() {
    var paldatastr =  " 0x00, 0x03, 0x19, 0x50, 0x52, 0x07, 0x1f, 0x37, 0xe0, 0xa4, 0xfd, 0xff, 0x38, 0x70, 0x7f, 0xf8, ";
    var fmt = {w:14,h:16,bpp:4,brev:1};
    var datastr = "0x00,0x00,0xef,0xef,0xe0,0x00,0x00, 0x00,0xee,0xee,0xfe,0xee,0xe0,0x00, 0x0e,0xed,0xef,0xef,0xed,0xee,0x00, 0x0e,0xee,0xdd,0xdd,0xde,0xee,0x00, 0x0e,0xee,0xed,0xde,0xee,0xee,0x00, 0x00,0xee,0xee,0xde,0xee,0xe0,0x00, 0x00,0xee,0xee,0xde,0xee,0xe0,0x00, 0x00,0x00,0xed,0xdd,0xe0,0x00,0x0d, 0xdd,0xdd,0xee,0xee,0xed,0xdd,0xd0, 0x0d,0xee,0xee,0xee,0xee,0xee,0x00, 0x0e,0xe0,0xee,0xee,0xe0,0xee,0x00, 0x0e,0xe0,0xee,0xee,0xe0,0xee,0x00, 0x0e,0xe0,0xdd,0xdd,0xd0,0xde,0x00, 0x0d,0x00,0xee,0x0e,0xe0,0x0d,0x00, 0x00,0x00,0xed,0x0e,0xe0,0x00,0x00, 0x00,0x0d,0xdd,0x0d,0xdd,0x00,0x18,";
    pixelEditorDecodeMessage({data:{fmt:fmt,bytestr:datastr,palfmt:{pal:332,n:16},palstr:paldatastr}});
    assert.deepEqual(palette, [0xff000000,
      0xff000060,
      0xff006020,
      0xff404000,
      0xff404040,
      0xff0000e0,
      0xff0060e0,
      0xff00c0e0,
      0xffc08000,
      0xff808080,
      0xffc0e0a0,
      0xffc0e0e0,
      0xff00e000,
      0xff40c000,
      0xff40e0e0,
      0xffc0e000,
    ]);
    assert.deepEqual(allimages, [[0,0,0,0,14,15,14,15,14,0,0,0,0,0,0,0,14,14,14,14,15,14,14,14,14,0,0,0,0,14,14,13,14,15,14,15,14,13,14,14,0,0,0,14,14,14,13,13,13,13,13,14,14,14,0,0,0,14,14,14,14,13,13,14,14,14,14,14,0,0,0,0,14,14,14,14,13,14,14,14,14,0,0,0,0,0,14,14,14,14,13,14,14,14,14,0,0,0,0,0,0,0,14,13,13,13,14,0,0,0,0,13,13,13,13,13,14,14,14,14,14,13,13,13,13,0,0,13,14,14,14,14,14,14,14,14,14,14,0,0,0,14,14,0,14,14,14,14,14,0,14,14,0,0,0,14,14,0,14,14,14,14,14,0,14,14,0,0,0,14,14,0,13,13,13,13,13,0,13,14,0,0,0,13,0,0,14,14,0,14,14,0,0,13,0,0,0,0,0,0,14,13,0,14,14,0,0,0,0,0,0,0,0,13,13,13,0,13,13,13,0,0,1,8]]);
    assert.equal(" 0x00, 0x03, 0x19, 0x50, 0x52, 0x07, 0x1F, 0x37, 0xE0, 0xA4, 0xFD, 0xFF, 0x38, 0x70, 0x7F, 0xF8, ",
      replaceHexBytes(paldatastr, parseHexBytes(paldatastr)));
  });
});