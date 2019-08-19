"use strict";

import { Platform, Base6502Platform, BaseMAMEPlatform, getOpcodeMetadata_6502, getToolForFilename_6502 } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap, dumpRAM, getMousePos, EmuHalt } from "../emu";
import { hex, lzgmini, stringToByteArray, lpad, rpad, rgb2bgr } from "../util";
import { MasterAudio, POKEYDeviceChannel, newPOKEYAudio } from "../audio";

declare var jt; // for 6502

// https://atarihq.com/danb/a7800.shtml
// https://atarihq.com/danb/files/maria_r1.txt
// https://sites.google.com/site/atari7800wiki/

var Atari7800_PRESETS = [
  {id:'sprites.dasm', name:'Sprites (ASM)'},
];

const SWCHA = 0;
const SWCHB = 2;
const INPT0 = 8;

const Atari7800_KEYCODE_MAP = makeKeycodeMap([
  [Keys.A,        INPT0+0, 0x80],
  [Keys.B,        INPT0+1, 0x80],
  [Keys.SELECT,   SWCHB, -0x02],
  [Keys.START,    SWCHB, -0x01],
  [Keys.UP,       SWCHA, -0x10],
  [Keys.DOWN,     SWCHA, -0x20],
  [Keys.LEFT,     SWCHA, -0x40],
  [Keys.RIGHT,    SWCHA, -0x80],
  
  [Keys.P2_A,     INPT0+2, 0x80],
  [Keys.P2_B,     INPT0+3, 0x80],
  //[Keys.P2_SELECT, 1, 2],
  //[Keys.P2_START,  1, 3],
  [Keys.P2_UP,     SWCHA, -0x01],
  [Keys.P2_DOWN,   SWCHA, -0x02],
  [Keys.P2_LEFT,   SWCHA, -0x04],
  [Keys.P2_RIGHT,  SWCHA, -0x08],
]);

// http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
// http://7800.8bitdev.org/index.php/7800_Software_Guide#APPENDIX_4:_FRAME_TIMING
const CLK = 3579545;
const cpuFrequency = 1789772;
const linesPerFrame = 262;
const numVisibleLines = 258-16;
const colorClocksPerLine = 454; // 456?
const colorClocksPreDMA = 28;
const romLength = 0xc000;

// TIA chip

class TIA {
  regs = new Uint8Array(0x20);
  
  reset() {
    this.regs.fill(0);
  }
  read(a : number) : number {
    return this.regs[a] | 0;
  }
  write(a : number, v : number) {
    this.regs[a] = v;
  }
  saveState() {
    return {
      regs: this.regs.slice(0)
    };
  }
  loadState(s) {
    for (let i=0; i<32; i++)
      this.write(i, s.regs[i]);
  }
  static stateToLongString(state) : string {
    let s = "";
    s += dumpRAM(state.regs, 0, 32);
    return s;
  }
}

// MARIA chip

class MARIA {
  bus;
  profiler;
  cycles : number = 0;
  regs = new Uint8Array(0x20);
  offset : number = -1;
  dll : number = 0;
  dlstart : number = 0;
  dli : boolean = false;
  h16 : boolean = false;
  h8 : boolean = false;
  pixels = new Uint8Array(320);
  WSYNC : number = 0;

  reset() {
    this.regs.fill(0);
  }
  read(a : number) : number {
    return this.regs[a] | 0;
  }
  write(a : number, v : number) {
    this.regs[a] = v;
    if (a == 0x04) this.WSYNC++;
    //console.log(hex(a), '=', hex(v));
  }
  saveState() {
    return {
      regs: this.regs.slice(0),
      offset: this.offset,
      dll: this.dll,
      dlstart: this.dlstart,
      dli: this.dli,
      h16: this.h16,
      h8: this.h8,
    };
  }
  loadState(s) {
    for (let i=0; i<32; i++)
      this.write(i, s.regs[i]);
    this.offset = s.offset;
    this.dll = s.dll;
    this.dlstart = s.dlstart;
    this.dli = s.dli;
    this.h16 = s.h16;
    this.h8 = s.h8;
  }
  isDMAEnabled() {
    return (this.regs[0x1c] & 0x60) == 0x40;
  }
  getDLLStart() {
    return (this.regs[0x0c] << 8) + this.regs[0x10];
  }
  getCharBaseAddress() {
    return (this.regs[0x14] << 8) + this.offset;
  }
  setVBLANK(b : boolean) {
    if (b) {
      this.regs[0x08] |= 0x80;
      this.offset = -1;
      this.dll = this.getDLLStart();
      this.dli = this.bus && (this.bus.read(this.dll) & 0x80) != 0; // if DLI on first zone
    } else {
      this.regs[0x08] &= ~0x80;
    }
  }
  readDLLEntry(bus) {
    this.profiler && this.profiler.logRead(this.dll);
    let x = bus.read(this.dll);
    this.offset = (x & 0xf);
    this.h16 = (x & 0x40) != 0;
    this.h8  = (x & 0x20) != 0;
    this.dlstart = (bus.read(this.dll+1)<<8) + bus.read(this.dll+2);
    //console.log(hex(this.dll,4), this.offset, hex(this.dlstart,4));
    this.dll = (this.dll + 3) & 0xffff; // TODO: can also only cross 1 page?
    this.dli = (bus.read(this.dll) & 0x80) != 0; // DLI flag is from next DLL entry
  }
  isHoley(a : number) : boolean {
    if (a & 0x8000) {
      if (this.h16 && (a & 0x1000)) return true;
      if (this.h8  && (a & 0x800))  return true;
    }
    return false;
  }
  readDMA(a : number) : number {
    if (this.isHoley(a))
      return 0;
    else {
      this.cycles += 3;
      //this.profiler && this.profiler.logRead(a);
      return this.bus.read(a);
    }
  }
  doDMA(platform : Atari7800Platform) {
    let bus = this.bus = platform.bus;
    let profiler = this.profiler = platform.profiler;
    this.cycles = 0;
    this.pixels.fill(this.regs[0x0]);
    if (this.isDMAEnabled()) {
      this.cycles += 16;
      // time for a new DLL entry?
      if (this.offset < 0) {
        this.readDLLEntry(bus);
      }
      // read the DL (only can span two pages)
      let dlhi = this.dlstart & 0xff00;
      let dlofs = this.dlstart & 0xff;
      do {
        // read DL entry
        profiler && profiler.logRead(dlhi + ((dlofs+0) & 0x1ff));
        let b0 = bus.read(dlhi + ((dlofs+0) & 0x1ff));
        let b1 = bus.read(dlhi + ((dlofs+1) & 0x1ff));
        if (b1 == 0) break; // end of DL
        let b2 = bus.read(dlhi + ((dlofs+2) & 0x1ff));
        let b3 = bus.read(dlhi + ((dlofs+3) & 0x1ff));
        let indirect = false;
        // extended header?
        if ((b1 & 31) == 0) {
          var pal = b3 >> 5;
          var width = 32 - (b3 & 31);
          var xpos = bus.read(dlhi + ((dlofs+4) & 0x1ff));
          var writemode = b1 & 0x80;
          indirect = (b1 & 0x20) != 0;
          dlofs += 5;
          this.cycles += 10;
        } else {
          // direct mode
          var xpos = b3;
          var pal = b1 >> 5;
          var width = 32 - (b1 & 31);
          var writemode = 0;
          dlofs += 4;
          this.cycles += 8;
        }
        let gfxadr = b0 + (((b2 + (indirect?0:this.offset)) & 0xff) << 8);
        xpos *= 2;
        // copy graphics data (direct)
        let readmode = (this.regs[0x1c] & 0x3) + (writemode?4:0);
        // double bytes?
        let dbl = indirect && (this.regs[0x1c] & 0x10) != 0;
        if (dbl) { width *= 2; }
        //if (this.offset == 0) console.log(hex(dla,4), hex(gfxadr,4), xpos, width, pal, readmode);
        for (var i=0; i<width; i++) {
          let data = this.readDMA( dbl ? (gfxadr+(i>>1)) : (gfxadr+i) );
          if (indirect) {
            let indadr = ((this.regs[0x14] + this.offset) << 8) + data;
            if (dbl && (i&1)) indadr++;
            data = this.readDMA(indadr);
          }
          // TODO: more modes
          switch (readmode) {
            case 0:	// 160 A/B
              for (let j=0; j<4; j++) {
                var col = (data >> 6) & 3;
                if (col > 0) {
                  this.pixels[xpos] = this.pixels[xpos+1] = this.regs[(pal<<2) + col];
                }
                data <<= 2;
                xpos = (xpos + 2) & 0x1ff;
              }
              break;
            case 2:	// 320 B/D (TODO?)
            case 3:	// 320 A/C
              for (let j=0; j<8; j++) {
                var col = (data & 128) ? 1 : 0;
                if (col > 0) {
                  this.pixels[xpos] = this.regs[(pal<<2) + col];
                }
                data <<= 1;
                xpos = (xpos + 1) & 0x1ff;
              }
              break;
          }
        }
      } while (this.cycles < colorClocksPerLine); // TODO?
      // decrement offset
      this.offset -= 1;
    }
    return this.cycles;
  }
  doInterrupt() : boolean {
    if (this.dli && this.offset < 0) {
      this.dli = false;
      return true;
    } else
      return false;
    //return this.dli;// && this.offset == 1;
  }
  static stateToLongString(state) : string {
    let s = "";
    s += dumpRAM(state.regs, 0, 32);
    s += "\n   DLL: $" + hex((state.regs[0x0c] << 8) + state.regs[0x10],4) + " @ $" + hex(state.dll,4);
    s += "\n    DL: $" + hex(state.dlstart,4);
    s += "\nOffset:  " + state.offset;
    s += "\n   DLI?  " + state.dli;
    return s;
  }
}

// Atari 7800

class Atari7800Platform extends Base6502Platform implements Platform {

  mainElement : HTMLElement;
  cpu;
  ram : Uint8Array;
  rom : Uint8Array;
  bios : Uint8Array;
  bus;
  video;
  audio;
  timer : AnimationTimer;
  inputs = new Uint8Array(16);
  regs6532 = new Uint8Array(4);
  scanline : number = 0;
  tia : TIA = new TIA();
  maria : MARIA = new MARIA();

  constructor(mainElement : HTMLElement) {
    super();
    this.mainElement = mainElement;
  }

  getPresets() {
    return Atari7800_PRESETS;
  }
  
  readInput(a:number) : number {
    this.profiler && this.profiler.logRead(a+0x20);
    switch (a) {
      case 0xc: return ~this.inputs[0x8] & 0x80; //INPT4
      case 0xd: return ~this.inputs[0x9] & 0x80; //INPT5
      default: return this.inputs[a]|0;
    }
  }

  start() {
    this.cpu = new jt.M6502();
    this.ram = new Uint8Array(0x1000);
    //this.bios = new Uint8Array(0x1000); // TODO
    // TODO: TIA access wastes a cycle
    this.bus = {
      read: newAddressDecoder([
        [0x0008, 0x000d,   0x0f, (a) => { return this.readInput(a); }],
        [0x0000, 0x001f,   0x1f, (a) => { return this.tia.read(a); }],
        [0x0020, 0x003f,   0x1f, (a) => { return this.maria.read(a); this.profiler && this.profiler.logRead(a+0x20);  }],
        [0x0040, 0x00ff,   0xff, (a) => { return this.ram[a + 0x800]; }],
        [0x0100, 0x013f,   0xff, (a) => { return this.bus.read(a); }], // shadow
        [0x0140, 0x01ff,  0x1ff, (a) => { return this.ram[a + 0x800]; }],
        [0x0280, 0x02ff,    0x3, (a) => { return this.inputs[a]; }],
        [0x1800, 0x27ff, 0xffff, (a) => { return this.ram[a - 0x1800]; }],
        [0x2800, 0x3fff,  0x7ff, (a) => { return this.bus.read(a | 0x2000); }], // shadow
        [0x4000, 0xffff, 0xffff, (a) => { return this.rom ? this.rom[a - 0x4000] : 0; }],
        [0x0000, 0xffff, 0xffff, (a) => { return 0; }], // TODO
      ]),
      write: newAddressDecoder([
        [0x0015, 0x001A,   0x1f, (a,v) => { this.audio.pokey1.setTIARegister(a, v); }],
        [0x0000, 0x001f,   0x1f, (a,v) => { this.tia.write(a,v); this.profiler && this.profiler.logWrite(a); }],
        [0x0020, 0x003f,   0x1f, (a,v) => { this.maria.write(a,v); this.profiler && this.profiler.logWrite(a+0x20); }],
        [0x0040, 0x00ff,   0xff, (a,v) => { this.ram[a + 0x800] = v; }],
        [0x0100, 0x013f,   0xff, (a,v) => { this.bus.write(a); }], // shadow
        [0x0140, 0x01ff,  0x1ff, (a,v) => { this.ram[a + 0x800] = v; }],
        [0x0280, 0x02ff,    0x3, (a,v) => { this.regs6532[a] = v; /*TODO*/ }],
        [0x1800, 0x27ff, 0xffff, (a,v) => { this.ram[a - 0x1800] = v; }],
        [0x2800, 0x3fff,  0x7ff, (a,v) => { this.bus.write(a | 0x2000, v); }], // shadow
        [0xbfff, 0xbfff, 0xffff, (a,v) => { }], // TODO: bank switching?
        [0x0000, 0xffff, 0xffff, (a,v) => { throw new EmuHalt("Write @ " + hex(a,4) + " " + hex(v,2)); }],
      ]),
    };
    this.cpu.connectBus(this.bus);
    // create video/audio
    this.video = new RasterVideo(this.mainElement, 320, numVisibleLines);
    this.audio = newPOKEYAudio(1);
    this.video.create();
    setKeyboardFromMap(this.video, this.inputs, Atari7800_KEYCODE_MAP, (o,key,code,flags) => {
      // TODO
    });
    this.timer = new AnimationTimer(60, this.nextFrame.bind(this));
    // setup mouse events
    var rasterPosBreakFn = (e) => {
      if (e.shiftKey) {
        var clickpos = getMousePos(e.target, e);
        this.runEval( (c) => {
          return (this.getRasterScanline() == (clickpos.y|0));
        });
      }
    };
    var jacanvas = $("#emulator").find("canvas");
    jacanvas.mousedown(rasterPosBreakFn);
  }
  
  advance(novideo : boolean) {
    var idata = this.video.getFrameData();
    var iofs = 0;
    var debugCond = this.getDebugCallback();
    var rgb;
    var mariaClocks = colorClocksPreDMA; // 7 CPU cycles until DMA
    // visible lines
    for (var sl=0; sl<linesPerFrame; sl++) {
      this.scanline = sl;
      var visible = sl < numVisibleLines;
      this.maria.setVBLANK(!visible);
      // iterate CPU with free clocks
      while (mariaClocks > 0) {
        // wait for WSYNC? (end of line)
        if (this.maria.WSYNC) {
          if (mariaClocks >= colorClocksPreDMA) {
            this.maria.WSYNC--;
            mariaClocks = colorClocksPreDMA; // 7 CPU cycles until DMA
          } else {
            break;
          }
        }
        // next CPU clock
        mariaClocks -= 4;
        if (debugCond && debugCond()) {
          debugCond = null;
          sl = 999;
          break;
        }
        this.cpu.clockPulse();
      }
      mariaClocks += colorClocksPerLine;
      // is this scanline visible?
      if (visible) {
        // do DMA for scanline?
        mariaClocks -= this.maria.doDMA(this);
        // copy line to frame buffer
        for (var i=0; i<320; i++) {
          idata[iofs++] = COLORS_RGBA[this.maria.pixels[i]];
        }
      }
      // do interrupt? (if visible or before 1st scanline)
      if ((visible || sl == linesPerFrame-1) && this.maria.doInterrupt()) {
        this.profiler && this.profiler.logInterrupt(0);
        mariaClocks -= this.cpu.setNMIAndWait() * 4;
      }
    }
    // update video frame
    if (!novideo) {
      this.video.updateFrame();
      // set background/border color
      let bkcol = this.maria.regs[0x0];
      $(this.video.canvas).css('background-color', COLORS_WEB[bkcol]);
    }
  }

  loadROM(title, data) {
    if (data.length == 0xc080) data = data.slice(0x80); // strip header
    this.rom = padBytes(data, romLength, true);
    this.reset();
  }
/*
  loadBIOS(title, data) {
    this.bios = padBytes(data, 0x1000);
    this.reset();
  }
*/
  isRunning() {
    return this.timer.isRunning();
  }

  pause() {
    this.timer.stop();
    this.audio.stop();
  }

  resume() {
    this.timer.start();
    this.audio.start();
  }

  reset() {
    this.cpu.reset();
    this.tia.reset();
    this.maria.reset();
    this.inputs.fill(0x0);
    this.inputs[SWCHA] = 0xff;
    this.inputs[SWCHB] = 1+2+8;
    this.cpu.clockPulse(); // TODO: needed for test to pass?
  }

  // TODO: don't log if profiler active
  readAddress(addr : number) {
    return this.bus.read(addr) | 0;
  }

  loadState(state) {
    this.unfixPC(state.c);
    this.cpu.loadState(state.c);
    this.fixPC(state.c);
    this.ram.set(state.b);
    this.tia.loadState(state.tia);
    this.maria.loadState(state.maria);
    this.loadControlsState(state);
  }
  saveState() {
    return {
      c:this.getCPUState(),
      b:this.ram.slice(0),
      tia:this.tia.saveState(),
      maria:this.maria.saveState(),
      in:this.inputs.slice(0)
    };
  }

  loadControlsState(state) {
    this.inputs.set(state.in);
  }

  saveControlsState() {
    return {
      in:this.inputs.slice(0)
    };
  }

  getCPUState() {
    return this.fixPC(this.cpu.saveState());
  }

  getRasterScanline() {
    return this.scanline;
  }

  getDebugCategories() {
    return ['CPU','Stack','TIA','MARIA'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'TIA': return TIA.stateToLongString(state.tia);
      case 'MARIA': return MARIA.stateToLongString(state.maria) + "\nScanline: " + this.scanline;
      default: return super.getDebugInfo(category, state);
    }
  }
}

///

const ATARI_NTSC_RGB = [
    0x000000,		// 00
    0x404040,		// 02
    0x6c6c6c,		// 04
    0x909090,		// 06
    0xb0b0b0,		// 08
    0xc8c8c8,		// 0A
    0xdcdcdc,		// 0C
    0xf4f4f4,		// 0E
    0x004444,		// 10
    0x106464,		// 12
    0x248484,		// 14
    0x34a0a0,		// 16
    0x40b8b8,		// 18
    0x50d0d0,		// 1A
    0x5ce8e8,		// 1C
    0x68fcfc,		// 1E
    0x002870,		// 20
    0x144484,		// 22
    0x285c98,		// 24
    0x3c78ac,		// 26
    0x4c8cbc,		// 28
    0x5ca0cc,		// 2A
    0x68b4dc,		// 2C
    0x78c8ec,		// 2E
    0x001884,		// 30
    0x183498,		// 32
    0x3050ac,		// 34
    0x4868c0,		// 36
    0x5c80d0,		// 38
    0x7094e0,		// 3A
    0x80a8ec,		// 3C
    0x94bcfc,		// 3E
    0x000088,		// 40
    0x20209c,		// 42
    0x3c3cb0,		// 44
    0x5858c0,		// 46
    0x7070d0,		// 48
    0x8888e0,		// 4A
    0xa0a0ec,		// 4C
    0xb4b4fc,		// 4E
    0x5c0078,		// 50
    0x74208c,		// 52
    0x883ca0,		// 54
    0x9c58b0,		// 56
    0xb070c0,		// 58
    0xc084d0,		// 5A
    0xd09cdc,		// 5C
    0xe0b0ec,		// 5E
    0x780048,		// 60
    0x902060,		// 62
    0xa43c78,		// 64
    0xb8588c,		// 66
    0xcc70a0,		// 68
    0xdc84b4,		// 6A
    0xec9cc4,		// 6C
    0xfcb0d4,		// 6E
    0x840014,		// 70
    0x982030,		// 72
    0xac3c4c,		// 74
    0xc05868,		// 76
    0xd0707c,		// 78
    0xe08894,		// 7A
    0xeca0a8,		// 7C
    0xfcb4bc,		// 7E
    0x880000,		// 80
    0x9c201c,		// 82
    0xb04038,		// 84
    0xc05c50,		// 86
    0xd07468,		// 88
    0xe08c7c,		// 8A
    0xeca490,		// 8C
    0xfcb8a4,		// 8E
    0x7c1800,		// 90
    0x90381c,		// 92
    0xa85438,		// 94
    0xbc7050,		// 96
    0xcc8868,		// 98
    0xdc9c7c,		// 9A
    0xecb490,		// 9C
    0xfcc8a4,		// 9E
    0x5c2c00,		// A0
    0x784c1c,		// A2
    0x906838,		// A4
    0xac8450,		// A6
    0xc09c68,		// A8
    0xd4b47c,		// AA
    0xe8cc90,		// AC
    0xfce0a4,		// AE
    0x2c3c00,		// B0
    0x485c1c,		// B2
    0x647c38,		// B4
    0x809c50,		// B6
    0x94b468,		// B8
    0xacd07c,		// BA
    0xc0e490,		// BC
    0xd4fca4,		// BE
    0x003c00,		// C0
    0x205c20,		// C2
    0x407c40,		// C4
    0x5c9c5c,		// C6
    0x74b474,		// C8
    0x8cd08c,		// CA
    0xa4e4a4,		// CC
    0xb8fcb8,		// CE
    0x003814,		// D0
    0x1c5c34,		// D2
    0x387c50,		// D4
    0x50986c,		// D6
    0x68b484,		// D8
    0x7ccc9c,		// DA
    0x90e4b4,		// DC
    0xa4fcc8,		// DE
    0x00302c,		// E0
    0x1c504c,		// E2
    0x347068,		// E4
    0x4c8c84,		// E6
    0x64a89c,		// E8
    0x78c0b4,		// EA
    0x88d4cc,		// EC
    0x9cece0,		// EE
    0x002844,		// F0
    0x184864,		// F2
    0x306884,		// F4
    0x4484a0,		// F6
    0x589cb8,		// F8
    0x6cb4d0,		// FA
    0x7ccce8,		// FC
    0x8ce0fc		// FE
];

var COLORS_RGBA = new Uint32Array(256);
var COLORS_WEB = [];
for (var i=0; i<256; i++) {
  COLORS_RGBA[i] = ATARI_NTSC_RGB[i>>1] | 0xff000000;
  COLORS_WEB[i] = "#"+hex(rgb2bgr(ATARI_NTSC_RGB[i>>1]),6);
}

///

PLATFORMS['atari7800'] = Atari7800Platform;