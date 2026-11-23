/** 仮想デートで練習する三場面と、音声入力で選べる返答。 */
import { datePlaces, type DatePlace } from './date-places';

type DateChoice = {
  label: string;
  phrases: RegExp;
  reply: string;
  takeaway: string;
  memory: string;
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
  memory: string;
};

export const sceneCount = 3;

/** 選んだ場所と前の返答に合わせて会話の場面を返す。 */
export function getDateScene(
  answers: readonly DateAnswer[],
  interest: string,
  place: DatePlace = datePlaces[0],
): DateScene | undefined {
  switch (answers.length) {
    case 0:
      return {
        title: '待ち合わせ',
        setting: place.setting,
        opening: place.opening,
        choices: [
          {
            ...place.options[0],
            reply: place.id === 'cafe'
              ? 'いいね。周りの音が少ないと、最初でも落ち着いて話せそう。'
              : 'いいね。そうしよう。どんなところが好きか、歩きながら聞かせて。',
            takeaway: '最初に自分の希望を伝えた',
          },
          {
            ...place.options[1],
            reply: place.id === 'cafe'
              ? 'いいね。外が見えると、最初の話題も見つけやすそう。'
              : 'いいね、私も気になってた。ゆっくり話せるといいね。',
            takeaway: '一緒に過ごしたい場所や過ごし方を提案した',
          },
        ],
      };
    case 1: {
      const requestedSeat = place.options[answers[0].choice]?.memory;
      return {
        title: '予定が変わったら',
        setting: place.change,
        opening: place.id === 'cafe'
          ? `ごめん、${requestedSeat}は15分待ちだって。ここで待つ？ それとも近くを少し歩く？`
          : '少し待つことになりそう。ここにいようか？ それとも近くを見て回る？',
        choices: [
          {
            label: place.id === 'cafe' ? '席が空くまで待とう' : 'ここで少し待とう',
            phrases: /^(ここで|席が空くまで|このまま)?(少し)?待(つ|とう|ちたい|ちましょう)$/,
            reply: 'うん、せっかくだし待とう。待っている間に、今日楽しみにしてたことを聞いてもいい？',
            takeaway: '予定が変わったときに、自分の希望を伝えた',
            memory: '待ち時間の会話',
          },
          {
            label: '近くを少し歩こう',
            phrases: /^(近くを)?(少し)?(歩こう|歩きたい|歩く|散歩(する|したい|しよう))$/,
            reply: '歩くのもいいね。向こうの通り、まだ行ったことがないから一緒に見てみよう。',
            takeaway: '予定が変わったときに、別の過ごし方を提案した',
            memory: 'ふたりの寄り道',
          },
        ],
      };
    }
    case 2:
      return {
        title: '別れ際に',
        setting: answers[1].choice === 0 ? '話しているうちに、帰る時間になりました。' : '少し歩いて、待ち合わせの場所に戻りました。',
        opening: `今日はありがとう。そういえば、私が好きな${interest}の話はまだできなかったね。次は何を話してみたい？`,
        choices: [
          {
            label: '好きになったきっかけを聞きたい',
            phrases: /^(好きになった)?きっかけ[をが]?(知りたい|聞きたい|教えて)$/,
            reply: 'うれしい。今度は、最初に好きになったときのことから話すね。',
            takeaway: '相手の好きなことを、もう少し聞いてみることにした',
            memory: '相手の好きなこと',
          },
          {
            label: '自分の好きなことも話したい',
            phrases: /^(自分|私|僕|俺)の(好きなこと|趣味)(も|を)?(話したい|紹介したい|話す)$/,
            reply: 'ぜひ聞きたい。好きになった理由まで聞けると、その人のことが少し分かる気がする。',
            takeaway: '相手の話を聞く流れから、自分の話題も出した',
            memory: '自分の好きなこと',
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
  const number = /^([12一二])(?:(?:番(?:目)?|つ目)(?:です|でお願いします)?)?$/.exec(phrase)?.[1];
  if (number) return number === '1' || number === '一' ? 0 : 1;

  return scene.choices.findIndex(({ label, phrases }) => phrase === label || phrases.test(phrase));
}
