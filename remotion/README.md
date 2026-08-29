# Birdseye Golf product demo

30-second looping sales demo (`BirdseyeDemo`) built in Remotion. 1920×1080 at 30fps.

## Preview

```bash
cd remotion
npm run dev
```

Studio opens at the URL printed in the terminal (usually `http://localhost:3000/BirdseyeDemo`).

## Render MP4 (email embed)

From the `remotion` folder:

```bash
npx remotion render BirdseyeDemo out/birdseye-demo.mp4
```

## Render GIF (~600px wide)

```bash
npx remotion render BirdseyeDemo out/birdseye-demo.gif --codec=gif --scale=0.3125 --every-nth-frame=3
```

That outputs 600×338 at 10fps. If the file is still over ~1MB, tighten it with [Gifsicle](https://www.lcdf.org/gifsicle/):

```bash
gifsicle --optimize=3 --colors=128 --lossy=60 out/birdseye-demo.gif -o out/birdseye-demo-email.gif
```

Or render a shorter loop (first 12 seconds):

```bash
npx remotion render BirdseyeDemo out/birdseye-demo.gif --codec=gif --scale=0.3125 --every-nth-frame=3 --frames=0-359
```
