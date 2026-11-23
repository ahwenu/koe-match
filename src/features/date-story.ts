/** 仮想デートの場面と、音声入力で選べる返答を定義する。 */

type DateChoice = {
  label: string;
  phrases: RegExp;
  reply: string;
  takeaway: string;
};

export type DateScene = {
  title: string;
  setting: string;
  opening: string;
  choices: readonly [DateChoice, DateChoice];
};

export type DateAnswer = {
  choice: number;
  response: string;
  reply: string;
  takeaway: string;
};

export const sceneCount = 3;

/** 前の返答を受けて、次の質問と有効な選択肢を返す。 */
export function getDateScene(
  answers: readonly DateAnswer[],
  interest: string,
): DateScene | undefined {
  switch (answers.length) {
    case 0:
      return {
        title: '待ち合わせ',
        setting: '駅前で合流。近くのカフェに向かいます。',
        opening: '会えてうれしい。最初は、静かな席と窓際の席ならどっちがいい？',
        choices: [
          {
            label: '静かな席で話したい',
            phrases: /^(静か(な席)?(で話したい|がいい|で|な方)?|落ち着いた席(がいい|で)?)$/,
            reply: 'いいね。周りの音が少ないと、最初でも落ち着いて話せそう。',
            takeaway: '会話に集中できる場所を最初に提案した',
          },
          {
            label: '窓際の席がいい',
            phrases: /^(窓(際|側|ぎわ)(の席)?(がいい|で話したい|にしよう|で)?|景色(の見える席がいい|が見たい))$/,
            reply: 'いいね。外が見えると、最初の話題も見つけやすそう。',
            takeaway: '二人が話しやすい席の条件を伝えた',
          },
        ],
      };
    case 1: {
      const requestedSeat = answers[0].choice === 0 ? '静かな席' : '窓際の席';
      return {
        title: '予定が変わったら',
        setting: 'カフェの入口で、希望の席が埋まっていると分かります。',
        opening: `ごめん、${requestedSeat}は15分待ちだって。ここで待つ？ それとも近くを少し歩く？`,
        choices: [
          {
            label: '席が空くまで待とう',
            phrases: /^(ここで|席が空くまで|このまま)?(少し)?待(つ|とう|ちたい|ちましょう)$/,
            reply: 'うん、せっかくだし待とう。待っている間に、今日楽しみにしてたことを聞いてもいい？',
            takeaway: '予定が変わったときに、自分の希望を伝えた',
          },
          {
            label: '近くを少し歩こう',
            phrases: /^(近くを)?(少し)?(歩こう|歩きたい|歩く|散歩(する|したい|しよう))$/,
            reply: '歩くのもいいね。向こうの通り、まだ行ったことがないから一緒に見てみよう。',
            takeaway: '予定が変わったときに、別の過ごし方を提案した',
          },
        ],
      };
    }
    case 2:
      return {
        title: '別れ際に',
        setting: answers[1].choice === 0 ? '席で話したあと、お店の外に出ました。' : '少し散歩して、駅前まで戻りました。',
        opening: `今日はありがとう。そういえば、私が好きな${interest}の話はまだできなかったね。次は何を話してみたい？`,
        choices: [
          {
            label: '好きになったきっかけを聞きたい',
            phrases: /^(好きになった)?きっかけ[をが]?(知りたい|聞きたい|教えて)$/,
            reply: 'うれしい。今度は、最初に好きになったときのことから話すね。',
            takeaway: '相手の好きなことを、もう少し聞いてみることにした',
          },
          {
            label: '自分の好きなことも話したい',
            phrases: /^(自分|私|僕|俺)の(好きなこと|趣味)(も|を)?(話したい|紹介したい|話す)$/,
            reply: 'ぜひ聞きたい。好きになった理由まで聞けると、その人のことが少し分かる気がする。',
            takeaway: '相手の話を聞く流れから、自分の話題も出した',
          },
        ],
      };
    default:
      return undefined;
  }
}

/** 発話が選択肢に明確に一致したときだけ、選択番号を返す。 */
export function findDateChoice(scene: DateScene, transcript: string): number {
  const phrase = transcript.normalize('NFKC').replace(/\s/g, '').replace(/[。.!！]+$/, '');
  if (/^(?:1|一)(?:番(?:目)?|つ目)?$/.test(phrase)) return 0;
  if (/^(?:2|二)(?:番(?:目)?|つ目)?$/.test(phrase)) return 1;
  return scene.choices.findIndex(({ label, phrases }) => phrase === label || phrases.test(phrase));
}
