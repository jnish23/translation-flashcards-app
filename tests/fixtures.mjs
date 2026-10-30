export const option = {
  kanji: '水を飲みたい', reading: 'みずをのみたい', romaji: 'mizu o nomitai',
  register: 'casual', nuance: 'A casual way to say you want to drink water.',
};
export const translations = { options: [
  option,
  { ...option, kanji: '水が飲みたいです', reading: 'みずがのみたいです', romaji: 'mizu ga nomitai desu', register: 'polite' },
  { ...option, kanji: 'お水をいただきたいです', reading: 'おみずをいただきたいです', romaji: 'omizu o itadakitai desu', register: 'humble' },
] };
export const check = {
  interpretation: 'I want to drink water.', interpretationNote: '',
  grammar: { verdict: 'needs_work', explanation: '飲むたい attaches たい to the dictionary form. Use the verb stem 飲み instead.' },
  naturalness: { verdict: 'needs_work', explanation: '水を飲みたい sounds natural when talking casually with family.' },
  meaningMatch: { verdict: 'not_provided', explanation: '' },
  corrections: [{ kind: 'error', original: '飲むたい', replacement: '飲みたい', explanation: 'Attach たい to the stem 飲み to express wanting to drink.' }],
  recommendation: { ...option, english: 'I want to drink water.' },
  breakdown: [
    { text: '水を', reading: 'みずを', explanation: '水 means water; を marks what you want to drink.' },
    { text: '飲みたい', reading: 'のみたい', explanation: '飲み is the stem of 飲む. Adding たい expresses the desire to drink.' },
  ],
};
// Representative UI contracts, not evaluations of a live model's linguistic quality.
export const scenarios = [
  { name: 'grammar error', phrase: '水を飲むたい', response: check },
  { name: 'awkward phrasing', phrase: '私の趣味は映画を見ることをすることです', response: {
    ...check, interpretation: 'My hobby is watching movies.',
    grammar: { verdict: 'correct', explanation: 'The sentence is understandable and grammatical.' },
    naturalness: { verdict: 'needs_work', explanation: 'ことをすること is unnecessarily wordy for stating a hobby.' },
    corrections: [{ kind: 'naturalness', original: '映画を見ることをすること', replacement: '映画を見ること', explanation: '見ること already turns watching movies into a noun phrase.' }],
    recommendation: { ...option, kanji: '趣味は映画を見ることです', reading: 'しゅみはえいがをみることです', romaji: 'shumi wa eiga o miru koto desu', register: 'polite', english: 'My hobby is watching movies.' },
    breakdown: [{ text: '趣味は映画を見ることです', reading: 'しゅみはえいがをみることです', explanation: 'は sets the topic; こと nominalizes watching movies, and です completes the statement politely.' }],
  } },
  { name: 'already natural', phrase: option.kanji, response: {
    ...check, grammar: { verdict: 'correct', explanation: 'This is grammatically correct.' },
    naturalness: { verdict: 'natural', explanation: 'This is already natural in casual conversation. Keep it unchanged.' }, corrections: [],
  } },
  { name: 'register mismatch', phrase: 'ご確認いただけますでしょうか', response: {
    ...check, interpretation: 'Could you please check?',
    grammar: { verdict: 'correct', explanation: 'The request is grammatical.' },
    naturalness: { verdict: 'needs_work', explanation: 'This is too formal for speaking casually to your child.' },
    corrections: [{ kind: 'naturalness', original: 'ご確認いただけますでしょうか', replacement: '見てくれる？', explanation: 'A simple casual request fits this audience better.' }],
    recommendation: { ...option, kanji: '見てくれる？', reading: 'みてくれる？', romaji: 'mite kureru?', english: 'Can you take a look?' },
    breakdown: [{ text: '見てくれる？', reading: 'みてくれる？', explanation: '見て is the te-form of 見る; くれる asks for a favor casually.' }],
  } },
  { name: 'ambiguous meaning', phrase: '大丈夫', response: {
    ...check, interpretation: 'It could mean “I’m okay” or “No thanks.”', interpretationNote: 'Assuming you are reassuring someone that you are okay.',
    grammar: { verdict: 'correct', explanation: 'This is a valid short expression.' },
    naturalness: { verdict: 'uncertain', explanation: 'Its appropriateness depends on whether you are reassuring or declining.' },
    corrections: [], recommendation: { ...option, kanji: '大丈夫', reading: 'だいじょうぶ', romaji: 'daijoubu', english: 'I’m okay.' },
    breakdown: [{ text: '大丈夫', reading: 'だいじょうぶ', explanation: 'A common expression of reassurance; context also allows a polite refusal.' }],
  } },
  { name: 'intended meaning differs', phrase: '水を飲んだ', intendedMeaning: 'I want to drink water.', response: {
    ...check, interpretation: 'I drank water.',
    grammar: { verdict: 'correct', explanation: 'The past-tense sentence is grammatical.' },
    naturalness: { verdict: 'natural', explanation: 'This is natural, but expresses a completed action rather than a desire.' },
    meaningMatch: { verdict: 'differs', explanation: 'You described drinking in the past, but intended to express wanting to drink.' },
    corrections: [{ kind: 'error', original: '飲んだ', replacement: '飲みたい', explanation: 'Use the stem plus たい for desire, rather than the past form.' }],
  } },
];
