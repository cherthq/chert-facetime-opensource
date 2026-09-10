import { VideoFrame, VideoBufferType } from '@livekit/rtc-node';

// Original procedural face. Speaking animation is state-driven, not lip sync.
export const WIDTH = 320;
export const HEIGHT = 180;
export function avatarFrame(tick, speaking) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  const mouth = speaking ? 5 + 7 * Math.abs(Math.sin(tick * 0.8)) : 3;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    let color = [16, 40, 52];
    if ((x-160)**2 + (y-82)**2 < 65**2) color = [141, 224, 196];
    if ((Math.abs(x-137)<5 || Math.abs(x-183)<5) && Math.abs(y-62)<7) color = [16,40,52];
    if (((x-160)/24)**2 + ((y-104)/mouth)**2 < 1) color = [16,40,52];
    if (y>164 && y<173 && x>tick*4%300 && x<tick*4%300+16) color = [255,200,118];
    const i = (y*WIDTH+x)*4;
    pixels[i]=color[0]; pixels[i+1]=color[1]; pixels[i+2]=color[2]; pixels[i+3]=255;
  }
  return new VideoFrame(pixels, WIDTH, HEIGHT, VideoBufferType.RGBA);
}
