// The pictures, in the order the puzzles come round: puzzle No. n is SCENES[(n - 1) % SCENES.length].
import type { Scene } from "./common";
import { highStreet } from "./highStreet";
import { beach } from "./beach";
import { kitchen } from "./kitchen";
import { market } from "./market";
import { bookshelf } from "./bookshelf";
import { funfair } from "./funfair";
import { harbour } from "./harbour";
import { sweetShop } from "./sweetShop";
import { park } from "./park";
import { station } from "./station";

export const SCENES: Scene[] = [highStreet, beach, kitchen, market, bookshelf, funfair, harbour, sweetShop, park, station];

export const sceneFor = (no: number) => SCENES[(((no - 1) % SCENES.length) + SCENES.length) % SCENES.length];
