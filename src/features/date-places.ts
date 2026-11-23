/** デート練習で選択できる場所と、それぞれの会話のきっかけ。 */
import type { ImageSourcePropType } from 'react-native';

type PlaceOption = { label: string; phrases: RegExp; memory: string };

export type DatePlace = {
  id: string;
  label: string;
  mood: string;
  tint: 'blue' | 'mint' | 'yellow' | 'rose';
  image: ImageSourcePropType;
  setting: string;
  opening: string;
  options: readonly [PlaceOption, PlaceOption];
  change: string;
  question: string;
};

export const datePlaces: readonly DatePlace[] = [
  {
    id: 'cafe', label: 'カフェ', mood: '窓際でゆっくり', tint: 'blue',
    image: require('../../design/images/scenes/v33-cafe.webp'),
    setting: '駅前で合流。近くのカフェに向かいます。',
    opening: '会えてうれしい。最初は、静かな席と窓際の席ならどっちがいい？',
    options: [
      { label: '静かな席で話したい', phrases: /^(静か(な席)?(で話したい|がいい|で|な方)?|落ち着いた席(がいい|で)?)$/, memory: '静かな席' },
      { label: '窓際の席がいい', phrases: /^(窓(際|側|ぎわ)(の席)?(がいい|で話したい|にしよう|で)?|景色(の見える席がいい|が見たい))$/, memory: '窓際の席' },
    ],
    change: '希望の席は15分待ちだそうです。',
    question: '最近のお気に入りの飲み物は？',
  },
  {
    id: 'park', label: '公園', mood: '並んで散歩', tint: 'mint',
    image: require('../../design/images/scenes/v33-park.webp'),
    setting: '公園の入口で待ち合わせ。小道の先には並木と池があります。',
    opening: '来てくれてありがとう。並木道を歩くか、池のほとりに寄るか、どっちにしよう？',
    options: [
      { label: '並木道を歩きたい', phrases: /^(並木道|木陰)(を歩きたい|を歩こう|がいい|にしよう)?$/, memory: '並木道' },
      { label: '池のほとりに寄りたい', phrases: /^池(のほとり)?(に寄りたい|に行きたい|がいい|にしよう)?$/, memory: '池のほとり' },
    ],
    change: '通りたい小道が混み合っています。',
    question: '休日によく歩く場所は？',
  },
  {
    id: 'izakaya', label: '立ち飲み', mood: 'カウンターで乾杯', tint: 'yellow',
    image: require('../../design/images/scenes/v33-izakaya.webp'),
    setting: '仕事帰りに立ち飲みのお店へ。店先でメニューを眺めます。',
    opening: 'おつかれさま。まずはカウンターと立ちテーブル、どっちが話しやすそう？',
    options: [
      { label: 'カウンターがいい', phrases: /^カウンター(がいい|で|にしよう)?$/, memory: 'カウンター席' },
      { label: '立ちテーブルで話したい', phrases: /^(立ち)?テーブル(で話したい|がいい|にしよう)?$/, memory: '立ちテーブル' },
    ],
    change: '希望の場所に先客がいて、少し待つことになりそうです。',
    question: '乾杯するときは何を頼む？',
  },
  {
    id: 'riverside', label: '川沿い', mood: '夜の散歩道', tint: 'rose',
    image: require('../../design/images/scenes/v33-riverside.webp'),
    setting: '夕暮れの川沿いで合流。街灯が水面に映り始めています。',
    opening: 'ちょうど灯りがついてきたね。水辺をゆっくり歩く？ それとも橋の向こうまで行ってみる？',
    options: [
      { label: '水辺をゆっくり歩きたい', phrases: /^(水辺|川沿い)(を)?(ゆっくり)?(歩きたい|歩こう|がいい)?$/, memory: '水辺の散歩' },
      { label: '橋の向こうまで行きたい', phrases: /^橋(の向こう)?(まで行きたい|まで行こう|を渡りたい|がいい)?$/, memory: '橋の向こう' },
    ],
    change: '遊歩道の先で、通行が一時止まっています。',
    question: '夕方に見に行きたくなる景色は？',
  },
  {
    id: 'station', label: '駅前', mood: '待ち合わせから', tint: 'blue',
    image: require('../../design/images/scenes/v33-station.webp'),
    setting: '駅前の広場で会います。駅の近くには本屋と商店街があります。',
    opening: '見つけてくれてありがとう。近くの本屋を見る？ それとも商店街をぶらぶらする？',
    options: [
      { label: '本屋に寄りたい', phrases: /^本屋(に寄りたい|に行きたい|を見る|がいい)?$/, memory: '駅前の本屋' },
      { label: '商店街を歩きたい', phrases: /^商店街(を歩きたい|を歩こう|に行きたい|がいい)?$/, memory: '商店街' },
    ],
    change: '向かっていた通りはイベントの準備中です。',
    question: 'このあたりでよく行くお店は？',
  },
  {
    id: 'museum', label: '美術館', mood: '静かに語らう', tint: 'mint',
    image: require('../../design/images/scenes/v33-museum.webp'),
    setting: '美術館のロビーで合流。展示室の案内を二人で見ています。',
    opening: 'ゆっくり見られそうだね。作品を一緒に見て回る？ それぞれ見てから感想を話す？',
    options: [
      { label: '一緒に作品を見たい', phrases: /^一緒に(作品を)?(見たい|見よう|見て回りたい)?$/, memory: '展示を一緒に' },
      { label: 'あとで感想を話したい', phrases: /^(あとで|後で)?感想(を話したい|を話そう)?$/, memory: '感想を交換' },
    ],
    change: '最初に行こうとしていた展示室は入場待ちです。',
    question: '今日の展示で心に残った作品は？',
  },
];

/** 「公園にしたい」などの発話で、表示中の場所を選べるようにする。 */
export function findDatePlace(transcript: string) {
  const phrase = transcript.normalize('NFKC').replace(/[\s。.!！、]/g, '');
  const name = phrase.replace(/(?:がいい|にしたい|にする|で始める|でデートする|を選ぶ|を選んで|に行きたい)$/, '');
  return datePlaces.find((place) => place.label === name || (place.id === 'izakaya' && name === '居酒屋'));
}
