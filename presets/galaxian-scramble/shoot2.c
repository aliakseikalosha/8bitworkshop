#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;
typedef unsigned char sbyte;

byte __at (0x4800) vram[32][32];

struct {
  byte scroll;
  byte attrib;
} __at (0x5000) vcolumns[32];

struct {
  byte xpos;
  byte code;
  byte color;
  byte ypos;
} __at (0x5040) vsprites[8];

struct {
  byte unused1;
  byte xpos;
  byte unused2;
  byte ypos;
} __at (0x5060) vmissiles[8];

byte __at (0x6801) enable_irq;
byte __at (0x6804) enable_stars;
byte __at (0x6808) missile_width;
byte __at (0x6809) missile_offset;
byte __at (0x7000) watchdog;
volatile byte __at (0x8100) input0;
volatile byte __at (0x8101) input1;
volatile byte __at (0x8102) input2;

#define LEFT1 !(input0 & 0x20)
#define RIGHT1 !(input0 & 0x10)
#define UP1 !(input0 & 0x1)
#define DOWN1 !(input2 & 0x40)
#define FIRE1 !(input0 & 0x8)
#define BOMB1 !(input0 & 0x2)
#define COIN1 !(input0 & 0x80)
#define COIN2 !(input0 & 0x40)
#define START1 !(input1 & 0x80)
#define START2 !(input1 & 0x40)

__sfr __at (0x1) ay8910_a_reg;
__sfr __at (0x2) ay8910_a_data;
__sfr __at (0x4) ay8910_b_reg;
__sfr __at (0x8) ay8910_b_data;

inline void set8910a(byte reg, byte data) {
  ay8910_a_reg = reg;
  ay8910_a_data = data;
}
inline void set8910b(byte reg, byte data) {
  ay8910_b_reg = reg;
  ay8910_b_data = data;
}

typedef enum {
  AY_PITCH_A_LO, AY_PITCH_A_HI,
  AY_PITCH_B_LO, AY_PITCH_B_HI,
  AY_PITCH_C_LO, AY_PITCH_C_HI,
  AY_NOISE_PERIOD,
  AY_ENABLE,
  AY_ENV_VOL_A,
  AY_ENV_VOL_B,
  AY_ENV_VOL_C,
  AY_ENV_PERI_LO, AY_ENV_PERI_HI,
  AY_ENV_SHAPE
} AY8910Register;

///

void main();

void start() {
__asm
	LD      SP,#0x4800
        EI
; copy initialized data to RAM
        LD    BC, #l__INITIALIZER
        LD    A, B
        LD    DE, #s__INITIALIZED
        LD    HL, #s__INITIALIZER
        LDIR
__endasm;
	main();
}

const char __at (0x5000) palette[32] = {/*{pal:332,n:4}*/
  0x00,0x80,0xf0,0xff,0x00,0xf0,0xc0,0x7f,
  0x00,0xc0,0x04,0x1f,0x00,0xd0,0xd0,0x0f,
  0x00,0xc0,0xc0,0x0f,0x00,0x04,0x04,0x0f,
  0x00,0xff,0x0f,0xf0,0x00,0x7f,0x0f,0xdf,
};

const char __at (0x4000) tilerom[0x1000] = {/*{w:16,h:16,remap:[3,0,1,2,4,5,6,7,8,9,10],brev:1,np:2,pofs:2048,count:64}*/
0x00,0xfe,0x82,0x82,0x82,0xfe,0xfe,0x00,0x00,0x00,0xfe,0xfe,0xc0,0x00,0x00,0x00,0x00,0xf2,0xf2,0x92,0x92,0x9e,0x9e,0x00,0x00,0xfe,0xfe,0x92,0x92,0x82,0x00,0x00,0x08,0xfe,0xfe,0x88,0x88,0xf8,0xf8,0x00,0x00,0x9e,0x9e,0x92,0x92,0xf2,0xf2,0x00,0x00,0x9e,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0xf0,0xf0,0x9e,0x9e,0x80,0x80,0x00,0x00,0xfe,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0xfe,0x92,0x92,0x92,0xf2,0xf0,0x00,0x00,0xfe,0xc8,0x88,0x88,0xfe,0xfe,0x00,0x00,0xee,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0x82,0x82,0x82,0x86,0xfe,0xfe,0x00,0x00,0xfc,0x86,0x82,0x82,0xfe,0xfe,0x00,0x00,0x82,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0x80,0x90,0x90,0x90,0xfe,0xfe,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xfe,0xc8,0x88,0x88,0xfe,0xfe,0x00,0x00,0xee,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0x82,0x82,0x82,0x86,0xfe,0xfe,0x00,0x00,0xfc,0x86,0x82,0x82,0xfe,0xfe,0x00,0x00,0x82,0x92,0x92,0x92,0xfe,0xfe,0x00,0x80,0x90,0x90,0x90,0x90,0xfe,0xfe,0x00,0x00,0x9e,0x92,0x82,0x82,0xfe,0xfe,0x00,0xfe,0xfe,0x10,0x10,0x10,0xfe,0xfe,0x00,0x00,0x00,0xbe,0xbe,0x00,0x00,0x00,0x00,0xfc,0xfe,0x06,0x02,0x02,0x02,0x00,0x00,0x00,0x82,0x44,0x28,0x18,0xfe,0xfe,0x00,0x02,0x02,0x02,0x06,0xfe,0xfe,0x00,0x00,0xfe,0x40,0x20,0x18,0x20,0xfe,0xfe,0x00,0xfe,0x0c,0x08,0x10,0x20,0xfe,0xfe,0x00,0xfe,0x82,0x82,0x82,0x86,0xfe,0xfe,0x00,
0x00,0xf8,0x88,0x88,0x88,0xfe,0xfe,0x00,0x7e,0x86,0x8a,0x82,0x82,0xfe,0xfe,0x00,0xf8,0x8a,0x8c,0x88,0x88,0xfe,0xfe,0x00,0x00,0x9e,0x96,0x92,0x92,0xf2,0xf2,0x00,0x80,0x80,0xfe,0xfe,0x80,0x80,0x00,0x00,0x00,0xfe,0x06,0x02,0x02,0xfe,0xfe,0x00,0xf0,0x08,0x04,0x06,0x0c,0xf8,0xf0,0x00,0xf8,0x06,0x0c,0x18,0x0c,0xfe,0xf8,0x00,0x82,0x44,0x28,0x38,0x6c,0xc6,0x82,0x00,0x80,0x40,0x30,0x1e,0x3e,0x40,0x80,0x00,0xc2,0xe2,0xb2,0x9e,0x8e,0x86,0x82,0x00,0x00,0x10,0x10,0x10,0x10,0x10,0x10,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x40,0x80,0x80,0x78,0x7e,0x3f,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x7e,0x78,0x80,0x80,0x40,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x28,0x07,0x07,0x03,0x00,0x00,0x00,0x00,0x00,0x80,0xe0,0xf0,0x07,0x07,0x28,0x10,0x00,0x00,0x00,0x00,0xe0,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x18,0x04,0x03,0x03,0x03,0x00,0x00,0x00,0x00,0x00,0x80,0xe0,0xe0,0x07,0x27,0x18,0x00,0x00,0x00,0x00,0x00,0xf0,0xf8,0x40,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x0c,0x04,0x02,0x03,0x07,0x27,0x00,0x00,0x00,0x00,0x00,0x00,0xc0,0xe0,0x3f,0x03,0x00,0x00,0x00,0x00,0x00,0x00,0xe0,0xf0,0xc0,0x00,0x00,0x00,0x00,0x00,0x00,0x03,0x01,0x01,0x01,0x23,0x3f,0x07,0x00,0x00,0x00,0x00,0x80,0xc0,0xc0,0xe0,0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xe0,0xe0,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x01,0x13,0x1f,0x07,0x03,0x00,0x00,0x80,0x80,0x80,0xc0,0xe0,0xf0,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xf0,0xe0,0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x10,0x09,0x0f,0x07,0x07,0x00,0x80,0x40,0x80,0x80,0xc0,0xc0,0xc0,0x03,0x03,0x01,0x00,0x00,0x00,0x00,0x00,0xc0,0xc0,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x08,0x04,0x03,0x03,0x03,0x00,0x00,0x10,0x08,0x10,0x60,0xe0,0xe0,0x03,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0xe0,0xc0,0xc0,0x80,0x00,0x00,0x00,0x00,
0x00,0x00,0x03,0x00,0x00,0x00,0xe7,0x20,0x00,0x00,0xff,0x20,0x70,0x60,0x90,0x00,0xe7,0x00,0x00,0x00,0x03,0x00,0x00,0x00,0x90,0x60,0x70,0x20,0xff,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x0b,0x04,0x05,0x0f,0x00,0x00,0x00,0x00,0x80,0xe0,0xa0,0xb0,0x05,0x06,0x0b,0x10,0x00,0x00,0x00,0x00,0xa0,0x60,0xe0,0x00,0x00,0x00,0x00,0x00,0x10,0x08,0x05,0x21,0x10,0x08,0x41,0x1b,0x00,0x20,0x80,0x20,0x64,0x08,0x80,0x90,0x01,0x28,0x50,0x11,0x25,0x04,0x08,0x00,0x88,0x04,0x64,0x20,0x80,0x08,0x04,0x00,0x08,0x80,0xc1,0x02,0x14,0x00,0x40,0xc0,0x11,0x03,0x86,0x10,0x00,0x20,0x03,0x16,0x80,0x00,0x14,0x02,0x01,0xc0,0x84,0x04,0x00,0x20,0x00,0x10,0x83,0x01,0x30,0x18,0x00,0x00,0x00,0x10,0x04,0x26,0x00,0x00,0x00,0x80,0x80,0x00,0x00,0x40,0x00,0x30,0x00,0x26,0x04,0x10,0x00,0x00,0x00,0x00,0x00,0x40,0x00,0x00,0x80,0x80,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x03,0x00,0x00,0x02,0x04,0x08,0x11,0x29,0x00,0x00,0x00,0x00,0x00,0x20,0x14,0x00,0x04,0x00,0x00,0x81,0x01,0x01,0x08,0x00,0x01,0x81,0x00,0x00,0x43,0x2c,0x10,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x20,0xd0,0x10,0x00,0x80,0x01,0x00,0x00,0x00,0x08,0x80,0x00,0x00,0x04,0x04,0x00,0x48,0x10,0x60,0x08,0x14,0x10,0x08,0x04,0x02,0x00,0x00,0x92,0x00,0x08,0x01,0x01,0x11,0xd0,0x0a,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x05,0x05,0x03,0x00,0x00,0x00,0x00,0x00,0x98,0x00,0x00,0x00,0x01,0x80,0x00,0x00,0xc0,0x00,0x00,0x00,0x00,0x00,0x40,0x80,0x02,0x00,0x01,0x82,0x24,0x18,0x00,0x00,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x00,0x02,0x04,0x01,0x00,0x00,0x00,0x00,0x01,0x01,0x00,0x20,0x07,0x10,0x86,0x92,0x0c,0x68,0x20,0x00,0x00,0x00,0x00,0x00,0xc0,0x61,0x12,0x00,0x00,0x08,0x08,0x20,0x00,0x20,0x00,0x02,0x00,0xd1,0x02,0x01,0x34,0x05,0x00,0xc0,0x20,0x20,0x20,0x20,0x40,0x00,0xe0,0x04,0x0c,0x02,0x01,0x00,0x00,0x00,0x00,0xc0,0x40,0x40,0x40,0x00,0x00,0x3c,0x02,0x01,0x06,0x08,0x08,0x00,0x00,0x00,0x00,0x72,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x0a,0x08,0x00,0x00,0x44,0x00,0x20,0x10,0x10,0x20,0x00,0x00,0x08,0x40,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x00,0x04,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x04,0x04,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x00,0x00,0x01,0x10,0x00,0x00,0x00,0x00,0x00,0x00,0x80,0x00,0x00,0x02,0x02,0x00,0x00,0x00,0x00,0x04,0x00,0x00,0x00,0x00,0x00,0xa0,0x00,0x88,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x23,0x88,0x00,0x00,0x08,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x20,0x20,0x00,0x00,0x00,0x00,0x20,0x00,0x00,0x05,0x00,0x00,0xa8,0x00,0x00,0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x0c,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x02,0x42,0x00,0x00,0x00,0x00,0x00,0x00,0x20,0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x00,0x38,0x00,0x00,0x00,0x00,0x40,0x00,0x00,0x11,0x01,0x00,0x00,0x00,0x00,0x08,0x18,0x00,0x85,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x03,0x80,0x00,0x00,0x00,0x40,0x00,0x40,0xc0,0x18,0x08,0x00,0x00,0x00,0x00,0x00,0x80,0x02,0x02,0x00,0x80,0x00,0x20,0x20,0x00,0x00,0x00,0x00,0x00,

0x00,0xfe,0x82,0x82,0x82,0xfe,0xfe,0x00,0x00,0x00,0xfe,0xfe,0xc0,0x00,0x00,0x00,0x00,0xf2,0xf2,0x92,0x92,0x9e,0x9e,0x00,0x00,0xfe,0xfe,0x92,0x92,0x82,0x00,0x00,0x08,0xfe,0xfe,0x88,0x88,0xf8,0xf8,0x00,0x00,0x9e,0x9e,0x92,0x92,0xf2,0xf2,0x00,0x00,0x9e,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0xf0,0xf0,0x9e,0x9e,0x80,0x80,0x00,0x00,0xfe,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0xfe,0x92,0x92,0x92,0xf2,0xf0,0x00,0x00,0xfe,0xc8,0x88,0x88,0xfe,0xfe,0x00,0x00,0xee,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0x82,0x82,0x82,0x86,0xfe,0xfe,0x00,0x00,0xfc,0x86,0x82,0x82,0xfe,0xfe,0x00,0x00,0x82,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0x80,0x90,0x90,0x90,0xfe,0xfe,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xfe,0xc8,0x88,0x88,0xfe,0xfe,0x00,0x00,0xee,0x92,0x92,0x92,0xfe,0xfe,0x00,0x00,0x82,0x82,0x82,0x86,0xfe,0xfe,0x00,0x00,0xfc,0x86,0x82,0x82,0xfe,0xfe,0x00,0x00,0x82,0x92,0x92,0x92,0xfe,0xfe,0x00,0x80,0x90,0x90,0x90,0x90,0xfe,0xfe,0x00,0x00,0x9e,0x92,0x82,0x82,0xfe,0xfe,0x00,0xfe,0xfe,0x10,0x10,0x10,0xfe,0xfe,0x00,0x00,0x00,0xbe,0xbe,0x00,0x00,0x00,0x00,0xfc,0xfe,0x06,0x02,0x02,0x02,0x00,0x00,0x00,0x82,0x44,0x28,0x18,0xfe,0xfe,0x00,0x02,0x02,0x02,0x06,0xfe,0xfe,0x00,0x00,0xfe,0x40,0x20,0x18,0x20,0xfe,0xfe,0x00,0xfe,0x0c,0x08,0x10,0x20,0xfe,0xfe,0x00,0xfe,0x82,0x82,0x82,0x86,0xfe,0xfe,0x00,
0x00,0xf8,0x88,0x88,0x88,0xfe,0xfe,0x00,0x7e,0x86,0x8a,0x82,0x82,0xfe,0xfe,0x00,0xf8,0x8a,0x8c,0x88,0x88,0xfe,0xfe,0x00,0x00,0x9e,0x96,0x92,0x92,0xf2,0xf2,0x00,0x80,0x80,0xfe,0xfe,0x80,0x80,0x00,0x00,0x00,0xfe,0x06,0x02,0x02,0xfe,0xfe,0x00,0xf0,0x08,0x04,0x06,0x0c,0xf8,0xf0,0x00,0xf8,0x06,0x0c,0x18,0x0c,0xfe,0xf8,0x00,0x82,0x44,0x28,0x38,0x6c,0xc6,0x82,0x00,0x80,0x40,0x30,0x1e,0x3e,0x40,0x80,0x00,0xc2,0xe2,0xb2,0x9e,0x8e,0x86,0x82,0x00,0x00,0x10,0x10,0x10,0x10,0x10,0x10,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x49,0x91,0x92,0x04,0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x20,0x04,0x92,0x91,0x49,0x08,0x00,0x00,0x00,0x00,0x00,0x11,0x29,0x00,0x02,0x00,0x00,0x80,0x90,0x10,0x20,0x40,0x00,0x00,0x02,0x00,0x29,0x11,0x00,0x00,0x00,0x00,0x00,0x40,0x20,0x10,0x90,0x80,0x00,0x00,0x00,0x00,0x00,0x18,0x04,0x00,0x01,0x00,0x00,0x20,0x44,0x44,0x88,0x10,0x00,0x00,0x02,0x20,0x19,0x01,0x02,0x04,0x00,0x00,0x00,0x00,0x20,0x20,0x20,0x40,0x00,0x00,0x00,0x00,0x0c,0x04,0x00,0x00,0x01,0x20,0x00,0x00,0x00,0x20,0x40,0x84,0x08,0x10,0x32,0x00,0x04,0x08,0x10,0x01,0x00,0x00,0x00,0x00,0x00,0x40,0x80,0x00,0x00,0x00,0x00,0x03,0x01,0x00,0x00,0x20,0x30,0x02,0x00,0x00,0x10,0x10,0x22,0x84,0x18,0x00,0x00,0x04,0x19,0x01,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x10,0x18,0x02,0x00,0x00,0x00,0x80,0x90,0x10,0xa2,0x06,0x08,0x04,0x08,0x11,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x10,0x08,0x00,0x02,0x78,0x00,0x80,0x40,0x80,0x00,0x88,0x10,0x20,0x00,0x00,0x02,0x04,0x18,0x00,0x00,0x00,0x00,0x3c,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x08,0x04,0x00,0x01,0x0c,0x00,0x00,0x10,0x08,0x10,0x00,0x40,0x18,0x30,0x02,0x04,0x18,0x00,0x00,0x00,0x00,0x06,0x20,0x10,0x0c,0x00,0x00,0x00,0x00,
0x00,0x07,0x00,0x01,0x10,0x31,0xdf,0xdf,0x00,0xff,0xfc,0xff,0xf4,0xe8,0xf8,0xf8,0xdf,0x31,0x10,0x01,0x00,0x07,0x00,0x00,0xf8,0xe8,0xf4,0xff,0xfc,0xff,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x11,0x1c,0x08,0x00,0x00,0x00,0x00,0x80,0xb0,0x60,0x00,0x10,0x10,0x00,0x08,0x1c,0x11,0x01,0x00,0x00,0x00,0x10,0x00,0x00,0xb0,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x02,0x04,0x14,0x00,0x00,0x00,0x00,0x40,0x10,0x90,0x20,0x00,0x38,0x00,0x14,0x04,0x12,0x00,0x00,0x00,0x00,0x00,0x20,0x90,0x10,0x40,0x00,0x00,0x00,0x00,0x00,0x03,0x08,0x31,0x14,0x08,0x00,0x00,0x80,0xe0,0x00,0x80,0x10,0x20,0x10,0x08,0x14,0x31,0x08,0x03,0x00,0x00,0x00,0x20,0x10,0x80,0x00,0xe0,0x80,0x00,0x00,0x00,0x01,0x0d,0x21,0x04,0x00,0x1c,0x00,0x00,0x00,0xa0,0x80,0x00,0x00,0x00,0x50,0x1c,0x00,0x04,0x21,0x0d,0x01,0x00,0x00,0x00,0x00,0x00,0x80,0xa0,0x00,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x78,0x00,0x02,0x06,0x10,0x01,0x4a,0x00,0x10,0x00,0xa0,0x02,0x14,0x10,0x08,0x00,0x00,0x80,0x01,0x1c,0x40,0x86,0x01,0x81,0x60,0x00,0x04,0x90,0x70,0x08,0x02,0x00,0x40,0x00,0x00,0x40,0x00,0x20,0x00,0x10,0x7c,0x81,0x01,0x01,0x04,0x00,0x08,0x80,0x20,0x04,0x01,0x40,0x04,0x48,0x11,0xa0,0x00,0x02,0x00,0x08,0x84,0x02,0x01,0x00,0x18,0x86,0x80,0x0c,0x11,0x18,0xdb,0x05,0x80,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x0c,0x00,0x02,0x00,0x00,0x00,0x00,0x62,0x90,0x01,0x05,0x00,0x01,0x81,0x7c,0x01,0x40,0x00,0xc0,0x00,0x01,0x80,0x80,0x40,0x44,0x80,0x01,0x02,0x64,0x00,0x00,0x48,0x00,0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x20,0x00,0x00,0x04,0x03,0x00,0x00,0x18,0x00,0x12,0x10,0x0a,0xc2,0x00,0x01,0x00,0x00,0x01,0x00,0x02,0x00,0x21,0x02,0x19,0x8e,0xa2,0x6c,0xe4,0x70,0x00,0x00,0x00,0x00,0x00,0x60,0xe3,0x02,0x60,0x00,0x14,0x20,0x08,0x80,0x00,0x00,0x0e,0x5a,0x5b,0x8a,0x45,0x35,0x04,0x02,0xe0,0x00,0x10,0x90,0x40,0x20,0x00,0x80,0x12,0x15,0x04,0x00,0x00,0x00,0x02,0x02,0xc0,0x60,0x20,0x60,0x20,0x18,0x3c,0x00,0x01,0x0e,0x0a,0x10,0x18,0x10,0x00,0x30,0x05,0x20,0x00,0x00,0x00,0x00,0x00,0x80,0x00,0x00,0x00,0x00,0x00,0x09,0x08,0x08,0x40,0x40,0x0c,0x10,0x20,0x20,0xd0,0x00,0x08,0x70,0x00,0x40,0x00,0x00,0x00,0x00,0x00,0x08,0x00,0x24,0x12,0x0a,0x00,0x10,
0x00,0x00,0x60,0x30,0x18,0x08,0x00,0x00,0x10,0x40,0x20,0x40,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x00,0x20,0x20,0x00,0x00,0x00,0x40,0x10,0x08,0x0d,0x10,0x00,0x00,0x00,0x00,0x06,0x10,0x00,0x00,0x00,0x05,0x08,0x02,0x44,0x00,0x04,0x00,0x00,0x00,0x00,0x00,0x00,0xa0,0x10,0x88,0x04,0x00,0x00,0x00,0x00,0x00,0x06,0x04,0x00,0x00,0x00,0x08,0x08,0x04,0x00,0x00,0x00,0x00,0x00,0x01,0x01,0x01,0x00,0x00,0x00,0x08,0x12,0x24,0x08,0x50,0x00,0x40,0x00,0x00,0x70,0x04,0x00,0x01,0x0e,0x80,0xa8,0x00,0x80,0x20,0x40,0x60,0x00,0x80,0x08,0x00,0x08,0x00,0x00,0x00,0x00,0x08,0x00,0x00,0x02,0x00,0x00,0x88,0x00,0x40,0x00,0x39,0x04,0x02,0x00,0x00,0x00,0x00,0x00,0x40,0x60,0x38,0x01,0x08,0x04,0x02,0x00,0x30,0x30,0x18,0x04,0x00,0x01,0x00,0x0a,0x0c,0x04,0x02,0x02,0x04,0x70,0x70,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0xe0,0xe5,0x03,0x00,0x00,0x00,0x00,0x0c,0x18,0x40,0x80,0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x00,0x3a,0x00,0x08,0x98,0x70,0x00,0x20,0x0e,0x0e,0x01,0x00,0x00,0x02,0x80,0x90,0x23,0x31,0xbd,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x02,0x80,0x87,0x08,0x10,0x20,0x00,0x00,0x00,0x04,0x01,0x00,0x00,0x00,0x00,0x02,0x00,0x00,0x00,0x02,0x80,0x00,0x00,0x00,0x40,0x00,0x40,0x10,0x64,0x84,0x00,0x00,0x00,0x00,0x00,0x10,0xc8,0xc1,0xc0,0x38,0x20,0x80,0x50,0x10,0x08,0x00,0x00,0x80,
};

#define LOCHAR 0x30
#define HICHAR 0xff

#define CHAR(ch) (ch-LOCHAR)

#define BLANK 0x10

void memset_safe(void* _dest, char ch, word size) {
  byte* dest = _dest;
  while (size--) {
    *dest++ = ch;
  }
}

void clrscr() {
  memset_safe(vram, BLANK, sizeof(vram));
}

volatile byte video_framecount; // actual framecount

void _buffer() {
__asm
; padding to get to offset 0x66
  ld ix,#0
  ld ix,#0
__endasm;
}

// needs to start at offset 0x66
void rst_66() __interrupt {
  video_framecount++;
}

void reset_video_framecount() __critical {
  video_framecount = 0;
}

byte getchar(byte x, byte y) {
  return vram[29-x][y];
}

void putchar(byte x, byte y, byte ch) {
  vram[29-x][y] = ch;
}

void clrobjs() {
  byte i;
  memset_safe(vcolumns, 0, 0x100);
  for (i=0; i<8; i++)
    vsprites[i].ypos = 64;
}

void putstring(byte x, byte y, const char* string) {
  while (*string) {
    putchar(x++, y, CHAR(*string++));
  }
}

char in_rect(byte x, byte y, byte x0, byte y0, byte w, byte h) {
  return ((byte)(x-x0) < w && (byte)(y-y0) < h); // unsigned
}

void draw_bcd_word(byte x, byte y, word bcd) {
  byte j;
  x += 3;
  for (j=0; j<4; j++) {
    putchar(x, y, CHAR('0'+(bcd&0xf)));
    x--;
    bcd >>= 4;
  }
}

// add two 16-bit BCD values
word bcd_add(word a, word b) {
  a; b; // to avoid warning
__asm
        ld      hl,#4
        add     hl,sp
        ld      iy,#2
        add     iy,sp
        ld      a,0 (iy)
        add     a, (hl)
        daa
        ld      c,a
        ld      a,1 (iy)
        inc     hl
        adc     a, (hl)
        daa
        ld      b,a
        ld      l, c
        ld      h, b
__endasm;
}

// https://en.wikipedia.org/wiki/Linear-feedback_shift_register#Galois_LFSRs
static word lfsr = 1;
word rand() {
  byte lsb = lfsr & 1;   /* Get LSB (i.e., the output bit). */
  lfsr >>= 1;                /* Shift register */
  if (lsb) {                 /* If the output bit is 1, apply toggle mask. */
    lfsr ^= 0xB400u;
  }
  return lfsr;
}

// GAME CODE

typedef struct {
  byte shape;
} FormationEnemy;

// should be power of 2 length
typedef struct {
  byte findex;
  byte shape;
  word x;
  word y;
  byte dir;
  byte returning;
} AttackingEnemy;

typedef struct {
  signed char dx;
  byte xpos;
  signed char dy;
  byte ypos;
} Missile;

#define ENEMIES_PER_ROW 8
#define ENEMY_ROWS 4
#define MAX_IN_FORMATION (ENEMIES_PER_ROW*ENEMY_ROWS)
#define MAX_ATTACKERS 6

FormationEnemy formation[MAX_IN_FORMATION];
AttackingEnemy attackers[MAX_ATTACKERS];
Missile missiles[8];

byte formation_offset_x;
signed char formation_direction;
byte current_row;
byte player_x;
const byte player_y = 232;
byte player_exploding;
byte enemy_exploding;
byte enemies_left;
word player_score;
word framecount;

void add_score(word bcd) {
  player_score = bcd_add(player_score, bcd);
  draw_bcd_word(0, 1, player_score);
  putchar(4, 1, CHAR('0'));
}

void setup_formation() {
  byte i;
  memset(formation, 0, sizeof(formation));
  memset(attackers, 0, sizeof(attackers));
  memset(missiles, 0, sizeof(missiles));
  for (i=0; i<MAX_IN_FORMATION; i++) {
    byte flagship = i < ENEMIES_PER_ROW;
    formation[i].shape = flagship ? 0x43 : 0x43;
  }
  enemies_left = MAX_IN_FORMATION;
}

void draw_row(byte row) {
  byte i;
  byte y = 4 + row * 2;
  vcolumns[y].attrib = 0x2;
  vcolumns[y].scroll = formation_offset_x;
  for (i=0; i<ENEMIES_PER_ROW; i++) {
    byte x = i * 3;
    byte shape = formation[i + row*ENEMIES_PER_ROW].shape;
    if (shape) {
      putchar(x, y, shape);
      putchar(x+1, y, shape-2);
    } else {
      putchar(x, y, BLANK);
      putchar(x+1, y, BLANK);
    }
  }
}

void draw_next_row() {
  draw_row(current_row);
  if (++current_row == ENEMY_ROWS) {
    current_row = 0;
    formation_offset_x += formation_direction;
    if (formation_offset_x == 40) {
      formation_direction = -1;
    }
    else if (formation_offset_x == 0) {
      formation_direction = 1;
    }
  }
}

#define FLIPX 0x40
#define FLIPY 0x80
#define FLIPXY 0xc0

const byte DIR_TO_CODE[32] = {
  0, 1, 2, 3, 4, 5, 6, 6,
  6|FLIPXY, 6|FLIPXY, 5|FLIPXY, 4|FLIPXY, 3|FLIPXY, 2|FLIPXY, 1|FLIPXY, 0|FLIPXY,
  0|FLIPX, 1|FLIPX, 2|FLIPX, 3|FLIPX, 4|FLIPX, 5|FLIPX, 6|FLIPX, 6|FLIPX,
  6|FLIPY, 6|FLIPY, 5|FLIPY, 4|FLIPY, 3|FLIPY, 2|FLIPY, 1|FLIPY, 0|FLIPY,
};

const byte SINTBL[32] = {
  0, 25, 49, 71, 90, 106, 117, 125,
  127, 125, 117, 106, 90, 71, 49, 25,
  0, -25, -49, -71, -90, -106, -117, -125,
  -127, -125, -117, -106, -90, -71, -49, -25,
};

signed char isin(byte dir) {
  return SINTBL[dir & 31];
}

signed char icos(byte dir) {
  return isin(dir+8);
}

#define FORMATION_X0 18
#define FORMATION_Y0 27
#define FORMATION_XSPACE 24
#define FORMATION_YSPACE 16

byte get_attacker_x(byte formation_index) {
  byte column = (formation_index % ENEMIES_PER_ROW);
  return FORMATION_XSPACE*column + FORMATION_X0 + formation_offset_x;
}

byte get_attacker_y(byte formation_index) {
  byte row = formation_index / ENEMIES_PER_ROW;
  return FORMATION_YSPACE*row + FORMATION_Y0;
}

void draw_attacker(byte i) {
  AttackingEnemy* a = &attackers[i];
  if (a->findex) {
    byte code = DIR_TO_CODE[a->dir & 31];
    vsprites[i].code = code + a->shape + 14;
    vsprites[i].xpos = a->x >> 8;
    vsprites[i].ypos = a->y >> 8;
    vsprites[i].color = 2;
  } else {
    vsprites[i].ypos = 255; // offscreen
  }
}

void draw_attackers() {
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    draw_attacker(i);
  }
}

void return_attacker(AttackingEnemy* a) {
  byte fi = a->findex-1;
  byte destx = get_attacker_x(fi);
  byte desty = get_attacker_y(fi);
  byte ydist = desty - (a->y >> 8);
  // are we close to our formation slot?
  if (ydist == 0) {
    // convert back to formation enemy
    formation[fi].shape = a->shape;
    a->findex = 0;
  } else {
    a->dir = (ydist + 16) & 31;
    a->x = destx << 8;
    a->y += 128;
  }
}

void fly_attacker(AttackingEnemy* a) {
  a->x += isin(a->dir) * 2;
  a->y += icos(a->dir) * 2;
  if ((a->y >> 8) == 0) {
    a->returning = 1;
  }
}

void move_attackers() {
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex) {
      if (a->returning)
        return_attacker(a);
      else
        fly_attacker(a);
    }
  }
}

void think_attackers() {
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex) {
      // rotate?
      byte x = a->x >> 8;
      byte y = a->y >> 8;
      // don't shoot missiles after player exploded
      if (y < 128 || player_exploding) {
        if (x < 112) {
          a->dir++;
        } else {
          a->dir--;
        }
      } else {
        // lower half of screen
        // shoot a missile?
        if (missiles[i].ypos == 0) {
          missiles[i].ypos = 245-y;
          missiles[i].xpos = x+8;
          missiles[i].dy = -2;
        }
      }
    }
  }
}

void formation_to_attacker(byte formation_index) {
  byte i;
  // out of bounds? return
  if (formation_index >= MAX_IN_FORMATION)
    return;
  // nobody in formation? return
  if (!formation[formation_index].shape)
    return;
  // find an empty attacker slot
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex == 0) {
      a->x = get_attacker_x(formation_index) << 8;
      a->y = get_attacker_y(formation_index) << 8;
      a->shape = formation[formation_index].shape;
      a->findex = formation_index+1;
      a->dir = 0;
      a->returning = 0;
      formation[formation_index].shape = 0;
      break;
    }
  }
}

void draw_player() {
  vcolumns[29].attrib = 1;
  vcolumns[30].attrib = 1;
  vram[30][29] = 0x60;
  vram[31][29] = 0x62;
  vram[30][30] = 0x61;
  vram[31][30] = 0x63;
}

void move_player() {
  if (LEFT1 && player_x > 16) player_x--;
  if (RIGHT1 && player_x < 224) player_x++;
  if (FIRE1 && missiles[7].ypos == 0) {
    missiles[7].ypos = 252-player_y; // must be multiple of missile speed
    missiles[7].xpos = player_x+8; // player X position
    missiles[7].dy = 4; // player missile speed
  }
  vcolumns[29].scroll = player_x;
  vcolumns[30].scroll = player_x;
}

void move_missiles() {
  byte i;
  for (i=0; i<8; i++) { 
    if (missiles[i].ypos) {
      // hit the bottom or top?
      if ((byte)(missiles[i].ypos += missiles[i].dy) < 4) {
        missiles[i].xpos = 0xff; // hide offscreen
        missiles[i].ypos = 0;
      }
    }
  }
  // copy all "shadow missiles" to video memory
  memcpy(vmissiles, missiles, sizeof(missiles));
}

void blowup_at(byte x, byte y) {
  vsprites[6].color = 1;
  vsprites[6].code = 28;
  vsprites[6].xpos = x;
  vsprites[6].ypos = y;
  enemy_exploding = 1;
}

void animate_enemy_explosion() {
  if (enemy_exploding) {
    // animate next frame
    vsprites[6].code = 28 + enemy_exploding++;
    if (enemy_exploding > 4)
      enemy_exploding = 0; // hide explosion after 4 frames
  }
}

void animate_player_explosion() {
  byte z = player_exploding;
  if (z <= 5) {
    if (z == 5) {
      // erase explosion
      memset_safe(&vram[29][28], BLANK, 4);
      memset_safe(&vram[30][28], BLANK, 4);
      memset_safe(&vram[31][28], BLANK, 4);
      memset_safe(&vram[0][28], BLANK, 4);
    } else {
      // draw explosion
      z = 0xb0 + (z<<4);
      vcolumns[28].scroll = player_x;
      vcolumns[31].scroll = player_x;
      vcolumns[28].attrib = 2;
      vcolumns[29].attrib = 2;
      vcolumns[30].attrib = 2;
      vcolumns[31].attrib = 2;
      vram[29][28] = z+0x0;
      vram[29][29] = z+0x1;
      vram[29][30] = z+0x4;
      vram[29][31] = z+0x5;
      vram[30][28] = z+0x2;
      vram[30][29] = z+0x3;
      vram[30][30] = z+0x6;
      vram[30][31] = z+0x7;
      vram[31][28] = z+0x8;
      vram[31][29] = z+0x9;
      vram[31][30] = z+0xc;
      vram[31][31] = z+0xd;
      vram[0][28] = z+0xa;
      vram[0][29] = z+0xb;
      vram[0][30] = z+0xe;
      vram[0][31] = z+0xf;
    }
  }
}

void hide_player_missile() {
  missiles[7].ypos = 0;
  missiles[7].xpos = 0xff;
}

void does_player_shoot_formation() {
  byte mx = missiles[7].xpos;
  byte my = 255 - missiles[7].ypos; // missiles are Y-backwards
  signed char row = (my - FORMATION_Y0) / FORMATION_YSPACE;
  if (row >= 0 && row < ENEMY_ROWS) {
    // ok if unsigned (in fact, must be due to range)
    byte xoffset = mx - FORMATION_X0 - formation_offset_x;
    byte column = xoffset / FORMATION_XSPACE;
    byte localx = xoffset - column * FORMATION_XSPACE;
    if (column < ENEMIES_PER_ROW && localx < 16) {
      char index = column + row * ENEMIES_PER_ROW;
      if (formation[index].shape) {
        formation[index].shape = 0;
        enemies_left--;
        blowup_at(get_attacker_x(index), get_attacker_y(index));
        hide_player_missile();
        add_score(2);
      }
    }
  }
}

void does_player_shoot_attacker() {
  byte mx = missiles[7].xpos;
  byte my = 255 - missiles[7].ypos; // missiles are Y-backwards
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex && in_rect(mx, my, a->x >> 8, a->y >> 8, 16, 16)) {
      blowup_at(a->x >> 8, a->y >> 8);
      a->findex = 0;
      enemies_left--;
      hide_player_missile();
      add_score(5);
      break;
    }
  }
}

void does_missile_hit_player() {
  byte i;
  if (player_exploding)
    return;
  for (i=0; i<MAX_ATTACKERS; i++) {
    if (missiles[i].dy && 
        in_rect(missiles[i].xpos, 255-missiles[i].ypos, 
                player_x, player_y, 16, 16)) {
      player_exploding = 1;
      break;
    }
  }
}

void new_attack_wave() {
  byte i = rand();
  byte j;
  // find a random slot that has an enemy
  for (j=0; j<MAX_IN_FORMATION; j++) {
    i = (i+1) & (MAX_IN_FORMATION-1);
    // anyone there?
    if (formation[i].shape) {
      formation_to_attacker(i);
      formation_to_attacker(i+1);
      formation_to_attacker(i+ENEMIES_PER_ROW);
      formation_to_attacker(i+ENEMIES_PER_ROW+1);
      break;
    }
  }
}

void new_player_ship() {
  player_exploding = 0;
  draw_player();
  player_x = 112;
}

void set_sounds() {
  byte i;
  byte enable = 0;
  // missile fire sound
  if (missiles[7].ypos) {
    set8910a(AY_PITCH_A_LO, missiles[7].ypos);
    set8910a(AY_ENV_VOL_A, 15-(missiles[7].ypos>>4));
    enable |= 0x1;
  }
  // enemy explosion sound
  if (enemy_exploding) {
    set8910a(AY_PITCH_B_HI, enemy_exploding);
    set8910a(AY_ENV_VOL_B, 15);
    enable |= 0x2;
  }
  // player explosion
  if (player_exploding && player_exploding < 15) {
    set8910a(AY_ENV_VOL_C, 15-player_exploding);
    enable |= 0x4 << 3;
  }
  set8910a(AY_ENABLE, ~enable);
  // set diving sounds for spaceships
  enable = 0;
  for (i=0; i<3; i++) {
    byte y = attackers[i].y >> 8;
    if (y >= 0x80) {
      set8910b(AY_PITCH_A_LO+i, y);
      set8910b(AY_ENV_VOL_A+i, 7);
      enable |= 1<<i;
    }
  }
  set8910b(AY_ENABLE, ~enable);
}

void wait_for_frame() {
  while (((video_framecount^framecount)&3) == 0);
}

void play_round() {
  byte end_timer = 255;
  player_score = 0;
  add_score(0);
  putstring(0, 0, "PLAYER 1");
  setup_formation();
  formation_direction = 1;
  missile_width = 4;
  missile_offset = 0;
  reset_video_framecount();
  framecount = 0;
  new_player_ship();
  while (end_timer) {
    enable_irq = 0;
    enable_irq = 1;
    if (player_exploding) {
      if ((framecount & 7) == 1) {
        animate_player_explosion();
        if (++player_exploding > 32 && enemies_left) {
          new_player_ship();
        }
      }
    } else {
      if ((framecount & 0x7f) == 0 && enemies_left > 8) {
        new_attack_wave();
      }
      move_player();
      does_missile_hit_player();
    }
    if ((framecount & 3) == 0) animate_enemy_explosion();
    move_attackers();
    move_missiles();
    does_player_shoot_formation();
    does_player_shoot_attacker();
    draw_next_row();
    draw_attackers();
    if ((framecount & 0xf) == 0) think_attackers();
    set_sounds();
    framecount++;
    watchdog++;
    if (!enemies_left) end_timer--;
    putchar(12,0,video_framecount&3);
    putchar(13,0,framecount&3);
    putchar(14,0,(video_framecount^framecount)&3);
    wait_for_frame();
  }
  enable_irq = 0;
}

void main() {
  clrscr();
  clrobjs();
  enable_stars = 0xff;
  enable_irq = 0;
  play_round();
  main();
}

