// サンプルの一覧。シーン タブの「サンプルを開く」に並ぶ

import { coinAthletic } from './coin-athletic.js';
import { village } from './village.js';
import { arena } from './arena.js';

export const SAMPLES = [
  { id: 'coin', name: 'コイン集めアスレチック', genre: '3Dアクション', create: coinAthletic },
  { id: 'village', name: 'はじまりの村', genre: 'ADV + ターン制RPG', create: village },
  { id: 'arena', name: 'おばけアリーナ', genre: 'シューター / サバイバル', create: arena }
];

export const DEFAULT_SAMPLE = SAMPLES[0];
