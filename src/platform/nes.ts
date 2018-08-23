"use strict";

import { Platform, Base6502Platform, BaseMAMEPlatform, getOpcodeMetadata_6502, cpuStateToLongString_6502, getToolForFilename_6502 } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap, dumpRAM, dumpStackToString } from "../emu";
import { hex, lpad, lzgmini } from "../util";
import { CodeAnalyzer_nes } from "../analysis";
import { SampleAudio } from "../audio";

declare var jsnes : any;

const JSNES_PRESETS = [
  {id:'ex0.asm', name:'Initialization (ASM)'},
  {id:'ex1.asm', name:'Scrolling Demo (ASM)'},
  {id:'ex2.asm', name:'Sprite Demo (ASM)'},
  {id:'neslib1.c', name:'Text'},
  {id:'neslib2.c', name:'Sprites'},
  {id:'neslib3.c', name:'Cursor'},
  {id:'neslib4.c', name:'Metasprites'},
  {id:'neslib5.c', name:'RLE Unpack'},
  {id:'music.c', name:'Music Player'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'shoot2.c', name:'Solarian Game'},
  {id:'scrollrt.asm', name:'Split Screen Scroll (ASM)'},
  {id:'road.asm', name:'3-D Road (ASM)'},
  {id:'musicdemo.asm', name:'Famitone Demo (ASM)'},
];

const NES_NESLIB_PRESETS = [
  {id:'neslib1.c', name:'Text'},
  {id:'neslib2.c', name:'Sprites'},
  {id:'neslib3.c', name:'Cursor'},
  {id:'neslib4.c', name:'Metasprites'},
  {id:'chase/game.c', name:'Chase (example game)'},
];

const NES_CONIO_PRESETS = [
  {id:'ex0.asm', name:'ASM: Initialization'},
  {id:'ex1.asm', name:'ASM: Scrolling Demo'},
  {id:'hello.c', name:'C: Hello PPU'},
  {id:'conio.c', name:'C: Hello Console I/O'},
  {id:'siegegame.c', name:'C: Siege Game'},
];

/// JSNES

const JSNES_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_Z,     0, 0],
  [Keys.VK_X,     0, 1],
  [Keys.VK_2,     0, 2],
  [Keys.VK_1,     0, 3],
  [Keys.VK_UP,    0, 4],
  [Keys.VK_DOWN,  0, 5],
  [Keys.VK_LEFT,  0, 6],
  [Keys.VK_RIGHT, 0, 7],
  [Keys.VK_Q,     1, 0],
  [Keys.VK_E,     1, 1],
  [Keys.VK_4,     1, 2],
  [Keys.VK_3,     1, 3],
  [Keys.VK_W,     1, 4],
  [Keys.VK_S,     1, 5],
  [Keys.VK_A,     1, 6],
  [Keys.VK_D,     1, 7],
]);

const _JSNESPlatform = function(mainElement) {

  var nes;
  var rom;
  var video, audio, timer;
  const audioFrequency = 44030; //44100
  var frameindex = 0;
  var nsamples = 0;
  
 class JSNESPlatform extends Base6502Platform {
  debugPCDelta = 1;

  getPresets() { return JSNES_PRESETS; }

  start() {
    var self = this;
    video = new RasterVideo(mainElement,256,224);
    audio = new SampleAudio(audioFrequency);
    video.create();
    var idata = video.getFrameData();
    nes = new jsnes.NES({
      onFrame: function(frameBuffer) {
        for (var i=0; i<frameBuffer.length; i++)
          idata[i] = frameBuffer[i] | 0xff000000;
        video.updateFrame();
        self.restartDebugState();
        frameindex++;
        //if (frameindex == 2000) console.log(nsamples*60/frameindex,'Hz');
      },
      onAudioSample: function(left, right) {
        if (frameindex < 10)
          audio.feedSample(0, 1); // avoid popping at powerup
        else
          audio.feedSample(left+right, 1);
        //nsamples++;
      },
      onStatusUpdate: function(s) {
        console.log(s);
      },
      //TODO: onBatteryRamWrite
    });
    nes.stop = function() {
      // TODO: trigger breakpoint
      self.pause();
      console.log(nes.cpu.toJSON());
      throw ("CPU STOPPED @ PC $" + hex(nes.cpu.REG_PC));
    };
    // insert debug hook
    nes.cpu._emulate = nes.cpu.emulate;
    nes.cpu.emulate = function() {
      var cycles = nes.cpu._emulate();
      //if (self.debugCondition && !self.debugBreakState && self.debugClock < 100) console.log(self.debugClock, nes.cpu.REG_PC);
      self.evalDebugCondition();
      return cycles;
    }
    timer = new AnimationTimer(60, function() {
      nes.frame();
    });
    // set keyboard map
    setKeyboardFromMap(video, [], JSNES_KEYCODE_MAP, function(o,key,code,flags) {
      if (flags & 1)
        nes.buttonDown(o.index+1, o.mask); // controller, button
      else
        nes.buttonUp(o.index+1, o.mask); // controller, button
    });
  }
  
  advance(novideo : boolean) {
    nes.frame();
  }

  loadROM(title, data) {
    var romstr = String.fromCharCode.apply(null, data);
    nes.loadROM(romstr);
    frameindex = 0;
  }
  newCodeAnalyzer() {
    return new CodeAnalyzer_nes(this);
  }
  getOriginPC() {	// TODO: is actually NMI
    return (this.readAddress(0xfffa) | (this.readAddress(0xfffb) << 8)) & 0xffff;
  }
  getDefaultExtension() { return ".c"; };
  
  reset() {
    //nes.cpu.reset(); // doesn't work right, crashes
    nes.cpu.requestIrq(nes.cpu.IRQ_RESET);
  }
  isRunning() {
    return timer.isRunning();
  }
  pause() {
    timer.stop();
    audio.stop();
  }
  resume() {
    timer.start();
    audio.start();
  }

  runToVsync() {
    var frame0 = frameindex;
    this.runEval(function(c) { return frameindex>frame0; });
  }

  getCPUState() {
    var c = nes.cpu.toJSON();
    this.copy6502REGvars(c);
    return c;
  }
  // TODO don't need to save ROM?
  saveState() {
    //var s = $.extend(true, {}, nes);
    var s = nes.toJSON();
    s.c = s.cpu;
    this.copy6502REGvars(s.c);
    s.b = s.cpu.mem = s.cpu.mem.slice(0);
    s.ppu.vramMem = s.ppu.vramMem.slice(0);
    s.ppu.spriteMem = s.ppu.spriteMem.slice(0);
    s.ctrl = this.saveControlsState();
    return s;
  }
  loadState(state) {
    nes.fromJSON(state);
    //nes.cpu.fromJSON(state.cpu);
    //nes.mmap.fromJSON(state.mmap);
    //nes.ppu.fromJSON(state.ppu);
    nes.cpu.mem = state.cpu.mem.slice(0);
    nes.ppu.vramMem = state.ppu.vramMem.slice(0);
    nes.ppu.spriteMem = state.ppu.spriteMem.slice(0);
    this.loadControlsState(state.ctrl);
    //$.extend(nes, state);
  }
  saveControlsState() {
    return {
      c1: nes.controllers[1].state.slice(0),
      c2: nes.controllers[2].state.slice(0),
    };
  }
  loadControlsState(state) {
    nes.controllers[1].state = state.c1;
    nes.controllers[2].state = state.c2;
  }
  readAddress(addr) {
    return nes.cpu.mem[addr] & 0xff;
  }
  copy6502REGvars(c) {
    c.T = 0;
    c.PC = c.REG_PC;
    c.A = c.REG_ACC;
    c.X = c.REG_X;
    c.Y = c.REG_Y;
    c.SP = c.REG_SP & 0xff;
    c.Z = c.F_ZERO;
    c.N = c.F_SIGN;
    c.V = c.F_OVERFLOW;
    c.D = c.F_DECIMAL;
    c.C = c.F_CARRY;
    c.I = c.F_INTERRUPT;
    c.R = 1;
    c.o = this.readAddress(c.PC+1);
    return c;
  }

  getDebugCategories() {
    return ['CPU','ZPRAM','Stack','PPU'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6502(state.c);
      case 'ZPRAM': return dumpRAM(state.b, 0x0, 0x100);
      case 'Stack': return dumpStackToString(state.b, 0x100, 0x1ff, 0x100+state.c.SP);
      case 'PPU': return this.ppuStateToLongString(state.ppu, state.b);
    }
  }
  ppuStateToLongString(ppu, mem) {
    var s = '';
    var PPUFLAGS = [
      ["f_nmiOnVblank","NMI_ON_VBLANK"],
      ["f_spVisibility","SPRITES"],
      ["f_spClipping","CLIP_SPRITES"],
      ["f_dispType","MONOCHROME"],
      ["f_bgVisibility","BACKGROUND"],
      ["f_bgClipping","CLIP_BACKGROUND"],
    ];
    for (var i=0; i<PPUFLAGS.length; i++) {
      var flag = PPUFLAGS[i];
      s += (ppu[flag[0]] ? flag[1] : "-") + " ";
      if (i==2 || i==5) s += "\n";
    }
    var status = mem[0x2002];
    s += "\n Status ";
    s += (status & 0x80) ? "VBLANK " : "- ";
    s += (status & 0x40) ? "SPRITE0HIT " : "- ";
    s += "\n";
    if (ppu.f_color)
      s += "   Tint " + ((ppu.f_color&1)?"RED ":"") + ((ppu.f_color&2)?"BLUE ":"") + ((ppu.f_color&4)?"GREEN ":"") + "\n";
    if (ppu.f_spVisibility) {
      s += "SprSize " + (ppu.f_spriteSize ? "8x16" : "8x8") + "\n";
      s += "SprBase $" + (ppu.f_spPatternTable ? "1000" : "0000") + "\n";
    }
    if (ppu.f_bgVisibility) {
      s += " BgBase $" + (ppu.f_bgPatternTable ? "1000" : "0000") + "\n";
      s += " NTBase $" + hex(ppu.f_nTblAddress*0x400+0x2000) + "\n";
      s += "AddrInc " + (ppu.f_addrInc ? "32" : "1") + "\n";
    }
    var scrollX = ppu.regFH + ppu.regHT*8;
    var scrollY = ppu.regFV + ppu.regVT*8;
    s += "ScrollX $" + hex(scrollX) + " (" + ppu.regHT + " * 8 + " + ppu.regFH + " = " + scrollX + ")\n";
    s += "ScrollY $" + hex(scrollY) + " (" + ppu.regVT + " * 8 + " + ppu.regFV + " = " + scrollY + ")\n";
    s += " Vstart $" + hex(ppu.vramTmpAddress,4) + "\n";
    s += "\n";
    s += "   Scan Y: " + ppu.scanline + "  X: " + ppu.curX + "\n";
    s += " VRAM " + (ppu.firstWrite?"@":"?") + " $" + hex(ppu.vramAddress,4) + "\n";
    /*
    var PPUREGS = [
      'cntFV',
      'cntV',
      'cntH',
      'cntVT',
      'cntHT',
      'regV',
      'regH',
      'regS',
    ];
    s += "\n";
    for (var i=0; i<PPUREGS.length; i++) {
      var reg = PPUREGS[i];
      s += lpad(reg.toUpperCase(),7) + " $" + hex(ppu[reg]) + " (" + ppu[reg] + ")\n";
    }
    */
    return s;
  }
 }
  return new JSNESPlatform();
}

/// MAME support

class NESMAMEPlatform extends BaseMAMEPlatform {
// = function(mainElement, lzgRom, romSize) {
  lzgRom;
  romSize;

  start() {
    this.startModule(this.mainElement, {
      jsfile:'mamenes.js',
      //cfgfile:'nes.cfg',
      driver:'nes',
      width:256*2,
      height:240*2,
      romfn:'/emulator/cart.nes',
      romsize:this.romSize,
      romdata:new Uint8Array(new lzgmini().decode(this.lzgRom).slice(0, this.romSize)),
      preInit:function(_self) {
      },
    });
  }

  getOpcodeMetadata = getOpcodeMetadata_6502;
  getToolForFilename = getToolForFilename_6502;
  getDefaultExtension() { return ".c"; };
}

class NESConIOPlatform extends NESMAMEPlatform {
  lzgRom = NES_CONIO_ROM_LZG;
  romSize = 0xa010;

  getPresets() { return NES_CONIO_PRESETS; }

  loadROM(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":nes_slot:cart:prg_rom", data.slice(0x10, 0x8010));
    this.loadRegion(":nes_slot:cart:chr_rom", data.slice(0x8010, 0xa010));
  }
}

class NESLibPlatform extends NESMAMEPlatform {
  lzgRom = NES_NESLIB_ROM_LZG;
  romSize = 0x8010;

  getPresets() { return NES_NESLIB_PRESETS; }

  loadROM(title, data) {
    this.loadROMFile(data);
    this.loadRegion(":nes_slot:cart:prg_rom", data.slice(0x10, 0x8010));
  }
}

///

PLATFORMS['nes'] = _JSNESPlatform;
PLATFORMS['nes-lib'] = NESLibPlatform;
PLATFORMS['nes-conio'] = NESConIOPlatform;

///

var NES_CONIO_ROM_LZG = [
  76,90,71,0,0,160,16,0,0,11,158,107,131,223,83,1,9,17,21,22,78,69,83,26,2,1,3,0,22,6,120,216,
  162,0,134,112,134,114,134,113,134,115,154,169,32,157,0,2,157,0,3,157,0,4,232,208,244,32,134,130,32,85,129,169,
  0,162,8,133,2,134,3,32,93,128,32,50,129,32,73,129,76,0,128,72,152,72,138,72,169,1,133,112,230,107,208,2,
  230,108,32,232,129,169,32,141,6,32,169,0,22,129,141,5,22,66,104,170,104,168,104,64,160,0,240,7,169,105,162,128,
  76,4,96,96,162,0,21,23,0,32,22,195,1,22,194,63,21,37,21,134,22,197,41,21,27,173,41,96,201,4,32,169,
  129,240,3,76,158,128,76,188,128,169,184,162,130,24,109,41,96,144,1,232,160,0,32,130,129,141,7,21,36,238,41,96,
  21,32,76,140,128,21,47,33,21,246,201,17,14,61,15,21,253,227,128,76,1,129,169,169,17,24,61,209,21,125,17,2,
  180,17,10,130,5,22,201,128,17,4,172,30,141,1,32,76,46,129,22,65,96,173,0,96,174,1,96,32,112,130,173,2,
  96,174,3,21,65,160,4,76,105,128,17,3,228,188,162,130,17,2,228,169,188,133,10,169,130,133,11,169,0,133,12,169,
  96,133,13,162,214,169,255,133,18,160,0,232,240,13,177,10,145,12,200,208,246,230,11,230,13,208,240,230,18,208,239,96,
  133,10,134,11,162,0,177,10,96,208,42,162,0,138,96,240,36,22,163,30,48,28,22,227,2,16,20,22,227,14,144,12,
  21,200,176,4,22,226,162,0,169,1,96,165,115,208,252,96,169,255,197,115,240,252,96,133,118,132,116,134,117,32,193,129,
  164,113,165,116,153,0,2,165,117,153,0,3,165,118,153,0,4,200,132,113,230,115,96,164,115,208,1,96,166,114,169,14,
  141,42,96,189,0,2,141,6,32,189,0,3,22,163,4,141,7,32,232,136,240,93,17,19,14,71,17,19,14,49,17,19,
  14,27,17,19,14,5,206,42,96,208,141,134,114,132,115,96,169,0,162,0,72,165,2,56,233,2,133,2,176,2,198,3,
  160,1,138,145,2,104,136,145,2,96,169,41,133,10,169,96,17,34,41,168,162,0,240,10,145,10,200,208,251,230,11,202,
  208,246,192,2,240,5,21,70,247,96,78,111,32,99,97,114,116,32,108,111,97,100,101,100,0,1,0,16,32,17,66,184,
  141,18,96,142,19,96,141,25,96,142,26,96,136,185,255,255,141,35,22,196,34,96,140,37,96,32,255,255,160,255,208,232,
  96,17,71,230,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,10,53,128,0,128,92,128,
  17,14,14,204,204,51,51,22,106,0,24,60,126,24,22,1,22,231,16,48,127,127,48,16,0,22,230,12,18,48,124,48,
  98,252,22,231,0,0,3,62,118,54,54,22,231,127,127,17,4,80,22,230,224,224,96,22,3,22,230,24,24,24,248,248,
  21,16,22,230,204,153,51,102,22,106,51,153,204,22,107,21,27,255,255,17,4,67,22,227,3,22,13,17,6,188,22,230,
  17,2,172,22,13,31,31,22,236,255,255,22,236,31,31,17,4,136,22,227,22,1,248,248,21,5,22,233,17,14,123,17,
  3,64,22,230,17,3,64,21,248,17,8,29,21,216,17,6,88,17,3,64,22,230,240,22,13,21,233,21,243,22,230,17,
  6,16,22,226,192,192,48,48,22,106,15,22,1,21,84,22,230,17,10,4,22,226,17,10,52,22,230,17,6,16,17,10,
  44,22,6,17,35,220,0,24,22,231,102,102,17,34,107,0,22,233,255,22,33,102,22,231,24,62,96,60,6,124,21,40,
  22,229,0,102,12,24,48,102,70,22,231,60,102,60,56,103,102,63,22,231,6,12,17,36,59,22,230,21,30,48,48,24,
  12,22,231,22,97,12,21,4,22,231,0,102,60,255,60,17,2,115,22,230,24,24,126,17,35,70,22,230,17,4,173,21,
  33,22,231,126,21,205,22,231,21,80,22,232,3,6,12,24,48,96,22,231,60,102,110,118,102,102,60,22,231,24,24,56,
  24,24,24,126,22,231,60,102,6,12,48,96,22,235,28,6,21,168,22,228,6,14,30,102,127,6,6,22,231,126,96,124,
  6,21,80,22,230,60,102,96,124,17,4,88,22,228,126,102,12,17,35,83,22,230,60,21,13,21,216,22,231,62,21,240,
  22,228,17,34,124,22,66,22,236,17,2,224,22,228,14,24,48,96,48,24,14,0,22,230,17,2,239,17,4,241,22,228,
  112,24,12,6,12,24,112,22,231,17,2,192,24,21,52,22,232,110,110,96,98,17,3,248,22,227,24,60,102,126,17,34,
  228,22,230,124,102,102,22,66,22,231,60,102,96,96,96,17,4,200,22,227,120,108,21,30,108,120,22,231,126,96,96,120,
  96,96,126,22,237,96,22,231,21,48,110,17,37,8,22,227,21,46,17,3,96,22,230,60,17,99,19,21,24,22,229,30,
  12,22,1,108,56,22,231,102,108,120,112,120,108,21,40,22,229,17,132,62,126,22,231,99,119,127,107,99,99,99,22,231,
  102,118,126,126,110,17,2,88,22,229,60,102,22,2,17,35,88,22,227,17,2,205,21,49,22,231,21,144,60,14,22,231,
  21,80,17,2,96,22,230,60,102,96,60,17,37,208,22,227,17,163,13,17,34,200,22,229,21,111,17,5,208,22,232,60,
  17,5,16,22,225,99,99,99,107,127,119,99,22,231,21,77,60,17,3,248,22,230,21,1,17,4,64,22,227,126,17,67,
  159,126,22,231,60,48,22,2,60,22,231,96,48,24,12,6,3,0,22,231,60,17,34,32,12,21,24,22,229,17,34,193,
  17,68,244,22,229,22,3,17,165,133,22,225,17,134,203,22,230,21,58,6,62,102,62,22,232,96,17,66,176,124,22,232,
  0,60,96,96,96,17,66,144,22,229,6,21,31,21,96,22,230,0,60,102,126,21,216,22,228,14,24,62,17,3,84,22,
  230,0,21,95,6,124,22,231,17,3,80,102,17,5,88,22,225,24,0,56,17,34,240,22,231,6,0,6,22,1,60,22,
  231,96,96,108,17,34,128,22,231,21,30,21,160,22,230,0,102,127,127,107,99,22,233,17,2,79,21,32,22,231,17,34,
  210,17,4,152,22,228,17,36,242,22,232,17,3,144,6,22,232,124,17,66,226,21,160,22,228,17,131,225,22,232,17,130,
  127,17,98,112,22,230,17,35,226,17,34,0,22,233,60,17,2,240,22,230,99,107,127,62,17,226,24,22,230,17,35,241,
  22,234,21,47,12,120,22,232,126,12,24,48,17,98,194,22,228,28,48,24,112,24,48,28,22,231,17,164,159,22,3,22,
  227,56,12,24,14,24,12,56,0,22,230,51,255,204,17,35,206,22,230,22,14,17,194,92,22,10,17,236,246,204,204,255,
  231,195,129,231,22,1,22,231,239,207,128,128,207,239,255,22,230,243,237,207,131,207,157,3,22,231,255,255,252,193,137,201,
  201,22,231,128,128,17,4,80,22,230,31,31,159,22,3,22,230,231,231,231,7,7,21,16,22,230,17,236,246,204,17,237,
  246,51,153,17,227,11,17,4,67,22,227,252,22,13,17,6,188,22,230,17,2,172,22,13,224,224,22,236,0,0,22,236,
  224,224,17,4,136,22,227,22,1,7,7,21,5,22,233,17,14,123,17,3,64,22,230,17,3,64,21,248,17,8,29,21,
  216,17,6,88,17,3,64,22,230,17,226,124,22,10,17,238,244,22,226,17,6,16,22,226,63,63,207,207,22,106,17,226,
  192,21,84,22,230,17,10,4,17,230,220,17,14,60,17,234,252,17,6,44,22,6,17,35,220,255,231,22,231,153,153,17,
  34,107,255,22,233,0,22,33,153,22,231,231,193,159,195,249,131,21,40,22,229,255,153,243,231,207,153,185,22,231,195,153,
  195,199,152,153,192,22,231,249,243,17,36,59,22,230,21,30,207,207,231,243,22,231,22,97,243,21,4,22,231,255,153,195,
  0,195,17,2,115,22,230,231,231,129,17,35,70,22,230,17,4,173,21,33,22,231,129,21,205,22,231,21,80,22,232,252,
  249,243,231,207,159,22,231,195,153,145,137,153,153,195,22,231,231,231,199,231,231,231,129,22,231,195,153,249,243,207,159,22,
  235,227,249,21,168,22,228,249,241,225,153,128,249,249,22,231,129,159,131,249,21,80,22,230,195,153,159,131,17,4,88,22,
  228,129,153,243,17,35,83,22,230,195,21,13,21,216,22,231,193,21,240,22,228,17,34,124,22,66,22,236,17,2,224,22,
  228,241,231,207,159,207,231,241,255,22,230,17,2,239,17,4,241,22,228,143,231,243,249,243,231,143,22,231,17,2,192,231,
  21,52,22,232,145,145,159,157,17,3,248,22,227,231,195,153,129,17,34,228,22,230,131,153,153,22,66,22,231,195,153,159,
  159,159,17,4,200,22,227,135,147,21,30,147,135,22,231,129,159,159,135,159,159,129,22,237,159,22,231,21,48,145,17,37,
  8,22,227,21,46,17,3,96,22,230,195,17,99,19,21,24,22,229,225,243,22,1,147,199,22,231,153,147,135,143,135,147,
  21,40,22,229,17,132,62,129,22,231,156,136,128,148,156,156,156,22,231,153,137,129,129,145,17,2,88,22,229,195,153,22,
  2,17,35,88,22,227,17,2,205,21,49,22,231,21,144,195,241,22,231,21,80,17,2,96,22,230,195,153,159,195,17,37,
  208,22,227,17,163,13,17,34,200,22,229,21,111,17,5,208,22,232,195,17,5,16,22,225,156,156,156,148,128,136,156,22,
  231,21,77,195,17,3,248,22,230,21,1,17,4,64,22,227,129,17,67,159,129,22,231,195,207,22,2,195,22,231,159,207,
  231,243,249,252,255,22,231,195,17,34,32,243,21,24,22,229,17,34,193,17,68,244,22,229,22,3,17,165,133,22,225,17,
  134,203,22,230,21,58,249,193,153,193,22,232,159,17,66,176,131,22,232,255,195,159,159,159,17,66,144,22,229,249,21,31,
  21,96,22,230,255,195,153,129,21,216,22,228,241,231,193,17,3,84,22,230,255,21,95,249,131,22,231,17,3,80,153,17,
  5,88,22,225,231,255,199,17,34,240,22,231,249,255,249,22,1,195,22,231,159,159,147,17,34,128,22,231,21,30,21,160,
  22,230,255,153,128,128,148,156,22,233,17,2,79,21,32,22,231,17,34,210,17,4,152,22,228,17,36,242,22,232,17,3,
  144,249,22,232,131,17,66,226,21,160,22,228,17,131,225,22,232,17,130,127,17,98,112,22,230,17,35,226,17,34,0,22,
  233,195,17,2,240,22,230,156,148,128,193,17,226,24,22,230,17,35,241,22,234,21,47,243,135,22,232,129,243,231,207,17,
  98,194,22,228,227,207,231,143,231,207,227,22,231,17,164,159,22,3,22,227,199,243,231,241,231,243,199,255,22,230,204,0,
  51,17,35,206,22,230,22,14,9,19,0,13,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,22,31,
  22,31,22,31,22,31,22,31,22,31,22,30,22,28
];
var NES_NESLIB_ROM_LZG = [
  76,90,71,0,0,160,16,0,0,13,157,107,195,144,97,1,47,75,80,90,78,69,83,26,2,0,1,0,90,6,120,162,
  255,154,232,142,1,32,142,16,64,142,0,32,44,2,90,66,16,251,160,63,140,6,32,142,6,32,169,15,162,32,141,7,
  32,202,208,250,138,160,32,80,11,141,6,32,160,16,80,9,232,208,250,136,208,247,138,149,0,157,0,1,157,0,2,157,
  0,3,157,0,4,157,0,5,157,0,6,157,0,7,232,208,230,169,4,32,77,130,32,62,130,32,182,130,32,74,141,32,
  153,140,169,0,133,40,169,8,133,41,32,214,139,75,6,93,169,128,133,19,141,0,32,169,6,133,20,165,0,197,0,240,
  252,162,52,160,24,202,208,253,136,208,250,173,2,32,41,128,133,2,32,109,130,165,2,32,218,135,169,253,133,26,133,27,
  169,0,141,5,32,90,65,76,48,140,72,138,72,152,72,165,3,208,3,76,213,129,162,0,142,3,32,169,2,141,20,64,
  165,28,80,9,186,129,169,63,133,28,141,75,3,183,172,192,1,177,24,141,7,32,172,193,90,229,194,90,229,195,90,228,
  173,80,3,197,80,195,172,198,90,229,199,75,8,19,201,80,195,172,202,90,229,203,75,8,19,205,80,195,172,206,90,229,
  207,75,8,19,209,80,195,172,210,90,229,211,75,8,19,213,80,195,172,214,90,229,215,75,8,19,217,80,195,172,218,90,
  229,219,75,8,19,221,80,195,172,222,90,229,223,90,228,166,23,240,23,160,0,177,21,200,141,6,32,90,168,75,34,165,
  235,142,75,3,246,165,17,141,5,32,165,18,90,130,75,34,96,230,0,230,1,165,1,201,6,208,4,169,0,133,1,32,
  198,136,104,168,104,170,104,64,133,29,134,30,162,0,169,32,133,31,160,0,177,29,157,192,1,232,200,198,31,208,245,230,
  28,96,75,5,18,16,208,228,80,130,16,138,208,219,133,29,32,3,141,41,31,170,165,80,97,80,27,169,15,162,0,80,
  107,224,32,208,248,134,28,96,10,90,1,133,24,6,24,38,25,90,98,165,24,24,105,154,133,24,165,25,41,3,105,133,
  133,25,80,39,165,20,41,24,240,3,32,85,131,80,1,231,133,20,141,1,32,169,0,141,0,32,80,16,9,24,80,199,
  128,80,7,80,24,80,15,75,67,101,75,3,177,80,87,8,208,223,90,161,16,208,217,80,159,96,162,0,169,255,157,0,
  2,232,90,1,208,247,75,3,111,10,41,32,133,29,165,19,41,223,5,29,133,19,96,170,160,0,177,40,200,157,2,2,
  90,162,1,90,163,0,90,161,157,3,2,165,40,24,105,4,133,40,144,2,230,41,138,80,2,75,3,221,160,80,19,136,
  133,34,90,130,35,177,40,170,177,29,201,128,240,35,200,24,101,34,80,40,177,29,80,1,35,80,118,29,75,3,66,90,
  161,2,75,3,112,76,19,131,165,40,105,2,75,5,67,96,170,169,240,75,8,137,169,1,133,3,75,68,203,165,2,240,
  6,165,1,201,5,240,250,169,0,133,3,96,142,75,3,206,32,214,140,168,134,30,80,9,29,177,29,133,31,200,208,2,
  230,30,177,29,90,195,197,31,240,7,141,7,32,133,32,208,238,177,29,240,16,80,140,170,165,75,101,123,240,218,96,133,
  29,138,208,14,165,29,201,240,176,8,133,18,80,121,240,11,56,165,29,233,240,80,5,2,133,29,32,214,140,133,17,138,
  41,1,5,29,75,35,3,252,75,35,3,41,1,75,34,141,80,72,247,75,8,8,80,201,239,80,137,75,2,250,80,50,
  75,4,147,173,7,75,2,150,133,31,134,32,160,0,80,4,145,31,230,31,208,2,230,32,165,29,208,2,198,30,198,29,
  165,29,5,30,208,231,75,12,43,75,7,40,177,31,141,7,32,75,19,40,134,29,170,164,29,76,71,136,96,0,15,30,
  45,168,162,0,169,1,141,22,64,169,0,90,130,8,133,29,185,22,64,74,118,80,37,208,246,232,224,3,208,227,165,75,
  2,254,6,197,32,240,2,165,31,153,4,0,170,89,6,0,57,4,0,153,8,0,138,153,6,0,96,72,32,114,132,104,
  170,181,8,96,170,181,4,96,165,26,10,144,2,73,207,133,26,96,165,27,80,66,215,133,27,96,32,189,132,32,199,132,
  101,26,80,65,170,80,2,96,133,26,134,27,96,133,21,134,22,32,3,141,133,23,75,37,123,96,141,7,32,96,75,2,
  175,80,13,166,32,240,12,162,0,75,36,92,198,32,208,246,166,31,240,6,80,198,96,240,2,169,4,75,35,35,251,75,
  34,35,75,66,132,80,172,214,140,133,36,134,37,90,194,38,134,39,162,0,165,80,57,32,88,133,198,32,230,37,230,39,
  76,68,133,80,57,10,160,0,177,36,145,38,200,202,208,248,75,6,95,75,36,152,75,6,41,10,32,135,80,105,39,76,
  117,75,5,39,165,29,80,167,250,96,170,32,85,131,90,226,15,90,30,90,28,90,2,0,1,2,3,4,5,6,7,8,
  9,10,11,12,15,14,75,29,40,15,16,17,18,19,20,21,22,23,24,25,26,27,28,31,30,75,29,40,15,32,33,34,
  35,36,37,38,39,40,41,42,43,44,45,46,75,29,40,15,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,75,
  14,40,45,75,13,40,45,75,13,40,45,48,90,12,75,14,40,0,75,13,40,0,75,13,40,75,16,8,75,12,40,16,
  75,13,24,75,29,8,90,29,48,201,0,240,2,169,255,141,111,1,169,15,141,21,64,169,129,141,8,64,169,1,141,15,
  64,169,48,141,0,64,141,4,64,141,12,64,169,8,141,1,64,141,5,64,80,31,4,1,141,5,1,162,6,160,5,169,
  0,157,4,1,157,5,1,75,226,210,8,1,157,2,1,169,63,157,1,1,169,48,157,3,1,138,24,105,9,170,136,208,
  221,140,51,1,140,66,1,140,81,1,140,96,1,140,108,1,140,1,1,96,169,0,141,1,1,134,10,132,11,168,174,111,
  1,48,3,141,111,1,162,6,169,5,133,12,177,10,157,4,1,200,90,161,5,1,200,169,47,3,0,38,75,18,76,198,
  12,208,214,177,10,200,141,2,1,90,162,3,90,161,72,169,4,133,16,169,51,72,170,169,0,32,55,138,104,105,15,198,
  16,208,242,104,141,1,1,141,0,1,96,170,173,1,1,224,0,240,4,9,128,208,2,41,127,80,13,96,165,10,72,165,
  11,72,75,2,115,10,232,224,5,208,2,162,0,142,111,1,80,30,240,95,48,93,173,0,1,240,4,48,2,208,64,169,
  6,133,14,169,51,133,15,75,2,83,160,0,166,14,32,119,138,176,15,166,14,189,2,1,166,15,32,55,138,166,14,157,
  3,1,165,14,24,105,9,133,14,165,15,24,105,15,133,75,2,109,216,80,55,24,109,75,3,112,169,11,133,12,162,51,
  138,72,32,28,139,104,24,105,5,75,2,174,242,173,1,1,16,19,75,42,74,128,141,8,64,76,48,138,173,7,1,201,
  63,208,5,169,0,76,139,137,24,109,56,1,10,170,173,61,1,72,125,86,139,141,2,64,104,9,127,48,2,169,0,125,
  87,139,205,4,1,240,6,75,34,115,3,64,173,51,1,13,9,1,141,0,64,173,16,75,6,50,197,80,50,71,80,114,
  76,80,242,6,75,10,50,5,80,114,5,1,141,7,64,173,66,1,13,18,1,141,4,64,173,25,75,6,50,247,80,50,
  86,80,114,91,80,242,10,75,9,50,141,11,64,173,81,1,9,75,2,160,173,34,75,6,41,32,138,24,109,101,1,41,
  15,73,15,133,10,173,36,1,10,41,128,5,10,141,14,64,173,96,1,9,240,141,12,64,206,0,1,173,111,1,208,3,
  90,225,104,133,11,104,133,10,75,226,107,24,109,2,1,133,10,169,0,109,3,1,133,11,169,3,224,96,208,2,169,2,
  133,12,160,0,24,177,10,157,2,75,35,237,3,75,35,237,1,1,157,4,1,138,75,36,41,228,160,6,177,10,160,0,
  96,189,8,1,240,18,222,8,1,208,13,189,6,80,62,189,7,80,60,76,162,138,189,0,1,240,5,222,0,1,56,96,
  189,4,80,79,5,80,15,177,10,230,10,208,2,230,11,201,64,176,14,157,1,1,165,75,66,74,165,11,157,5,1,96,
  201,192,176,20,201,128,144,8,41,63,157,0,1,76,177,138,90,225,2,1,80,62,201,255,208,39,24,165,10,105,3,157,
  6,80,34,105,0,157,7,1,177,10,157,8,75,2,139,133,12,90,130,11,165,12,133,10,160,0,80,99,254,208,17,75,
  5,14,136,80,207,80,13,41,63,141,1,75,2,64,189,1,1,240,4,222,1,1,96,189,75,2,226,189,75,2,224,188,
  4,75,66,155,9,0,16,11,24,105,64,157,0,1,152,157,4,1,96,201,127,240,8,157,1,80,196,177,10,168,76,50,
  139,173,6,77,6,242,5,157,5,76,5,0,5,184,4,116,4,52,4,247,3,190,3,136,3,86,3,38,3,248,2,206,
  2,165,2,127,2,91,2,57,2,25,2,251,1,222,1,195,1,170,1,146,1,123,1,102,1,82,1,63,1,45,1,28,
  1,12,1,253,0,238,0,225,0,212,0,200,0,189,0,178,0,168,0,159,0,150,0,141,0,133,0,126,0,118,0,112,
  0,105,0,99,0,94,0,88,0,83,0,79,0,74,0,70,0,66,0,62,0,58,0,55,47,7,3,206,160,0,240,7,
  169,226,162,139,76,0,3,96,32,41,141,160,3,32,252,140,32,241,132,76,41,140,160,1,80,3,160,0,32,241,140,32,
  131,140,208,3,76,5,140,76,44,80,205,133,44,134,45,32,207,80,84,65,141,165,44,166,45,80,157,160,32,32,198,140,
  162,0,32,248,132,76,240,139,32,236,140,96,169,109,162,141,32,41,141,162,0,169,0,90,194,4,90,193,53,132,90,129,
  19,141,169,1,32,46,130,90,129,80,2,48,80,2,162,33,169,233,80,26,80,40,145,32,226,139,32,133,130,76,109,140,
  90,65,96,200,72,24,152,101,40,47,4,1,47,104,96,224,0,208,6,170,208,3,169,1,96,162,0,138,96,75,3,175,
  124,162,145,75,2,175,169,124,133,48,169,145,133,49,169,0,133,50,169,3,133,51,162,218,169,255,133,56,160,0,232,240,
  13,177,48,145,50,200,208,246,230,49,230,51,208,240,230,56,208,239,96,132,56,56,229,56,176,1,202,96,24,105,1,144,
  1,232,96,160,1,177,40,170,136,177,40,230,40,240,5,90,97,3,96,230,40,230,41,96,160,4,76,114,140,133,48,134,
  49,162,0,177,48,75,7,28,96,160,0,80,161,1,96,80,91,80,4,164,40,240,7,198,40,160,0,145,40,96,198,41,
  198,40,90,193,169,0,162,0,72,165,40,56,233,2,133,40,176,2,198,41,160,1,138,145,40,104,136,80,18,80,94,200,
  72,80,70,96,169,37,133,48,169,3,75,2,169,168,162,0,240,10,145,48,200,208,251,230,49,202,208,246,192,0,240,5,
  80,70,247,96,75,39,152,90,5,56,124,124,124,56,0,56,75,7,8,108,108,72,75,12,25,108,254,90,33,75,8,7,
  16,254,208,254,22,254,16,75,8,9,206,220,56,118,230,75,10,73,108,124,236,238,126,75,8,7,56,48,75,12,104,112,
  90,2,75,8,104,112,56,90,2,75,10,28,108,56,75,9,103,80,121,254,56,75,8,39,90,4,48,48,75,11,192,124,
  75,13,23,0,0,96,75,8,24,14,30,60,120,240,224,75,9,37,238,90,1,75,9,42,56,120,56,56,56,75,9,8,
  124,14,124,224,238,254,75,8,8,252,14,60,14,14,252,75,8,8,62,126,238,238,254,14,75,9,24,224,252,14,75,10,
  72,124,224,252,75,11,88,254,238,28,28,75,10,185,124,238,124,75,11,24,80,6,126,14,60,75,8,8,75,2,179,75,
  9,183,75,5,8,192,75,7,8,28,56,112,112,56,28,75,8,24,75,2,246,75,10,249,80,21,80,27,75,10,88,28,
  75,42,216,75,3,248,224,75,12,120,238,254,238,75,8,8,252,238,252,238,238,75,9,232,124,238,224,224,75,10,168,248,
  236,80,41,75,9,24,254,224,240,224,224,75,41,40,254,224,248,224,224,75,42,104,224,80,40,75,72,8,0,75,2,102,
  238,75,9,104,124,75,34,248,75,9,88,14,90,1,75,10,104,238,252,75,2,106,75,8,8,224,90,1,75,42,152,198,
  238,254,254,75,10,24,206,80,72,75,73,137,75,46,232,252,80,7,252,75,77,8,236,75,9,152,80,152,75,10,152,224,
  124,75,11,136,254,75,67,169,75,8,8,80,39,75,11,88,80,6,108,56,75,105,24,238,75,2,136,198,75,9,8,124,
  56,124,75,10,168,80,118,75,10,72,254,28,56,112,75,42,72,90,30,90,5,78,79,32,67,65,82,84,32,76,79,65,
  68,69,68,0,141,14,3,142,15,3,141,21,3,142,22,3,136,185,255,255,141,31,90,196,30,3,140,33,3,32,255,255,
  160,255,208,232,75,143,44,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  30,0,182,128,0,128,0,130,75,30,70,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,31,90,
  31,90,31,90,31,90,31,90,31,90,29,90,6,
];
