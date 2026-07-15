/* dino-assets.js */

window.DinoAssets = (() => {
  const SPRITE_SRC = "./assets/download.png";

  /*
    Sprite coordinates are based on the classic Chrome offline sprite layout.
    The source image is a horizontal sprite sheet.
  */
  const SPRITES = {
    restart: {
      x: 2,
      y: 2,
      w: 36,
      h: 32,
    },

    cloud: {
      x: 86,
      y: 2,
      w: 46,
      h: 14,
    },

    horizon: {
      x: 2,
      y: 54,
      w: 1196,
      h: 12,
    },

    cactusSmall1: {
      x: 227,
      y: 0,
      w: 18,
      h: 35,
    },

    cactusSmall2: {
      x: 245,
      y: 0,
      w: 34,
      h: 35,
    },

    cactusSmall3: {
      x: 279,
      y: 0,
      w: 52,
      h: 35,
    },

    cactusLarge1: {
      x: 332,
      y: 0,
      w: 25,
      h: 50,
    },

    cactusLarge2: {
      x: 357,
      y: 0,
      w: 50,
      h: 50,
    },

    cactusLarge3: {
      x: 407,
      y: 0,
      w: 75,
      h: 50,
    },

    moon: {
      x: 483,
      y: 0,
      w: 19,
      h: 40,
    },

    star: {
      x: 642,
      y: 0,
      w: 10,
      h: 10,
    },

    // textSprite: {
    //   x: 655,
    //   y: 2,
    //   w: 191,
    //   h: 11,
    // },

    trexIdle: {
      x: 848,
      y: 2,
      w: 44,
      h: 47,
    },

    trexRun1: {
      x: 936,
      y: 2,
      w: 44,
      h: 47,
    },

    trexRun2: {
      x: 980,
      y: 2,
      w: 44,
      h: 47,
    },

    trexCrashed: {
      x: 1024,
      y: 2,
      w: 44,
      h: 47,
    },

    trexDuck1: {
      x: 1112,
      y: 16,
      w: 59,
      h: 30,
    },

    trexDuck2: {
      x: 1171,
      y: 16,
      w: 59,
      h: 30,
    },

    ptero1: {
      x: 132,
      y: 0,
      w: 46,
      h: 40,
    },

    ptero2: {
      x: 178,
      y: 0,
      w: 46,
      h: 40,
    },
  };

  function loadImage(src = SPRITE_SRC) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    });
  }

  async function load() {
    const image = await loadImage();

    return {
      image,
      sprites: SPRITES,
      draw(ctx, name, dx, dy, scale = 1) {
        const s = SPRITES[name];

        if (!s) {
          throw new Error(`Unknown sprite: ${name}`);
        }

        ctx.drawImage(
          image,
          s.x,
          s.y,
          s.w,
          s.h,
          Math.round(dx),
          Math.round(dy),
          Math.round(s.w * scale),
          Math.round(s.h * scale)
        );
      },
    };
  }

  return {
    load,
    SPRITES,
  };
})();
