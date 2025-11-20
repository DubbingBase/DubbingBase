import { ElementType } from "./models.ts";

/** Check if is multiline */
export const isMultiLineLi1 =
  /\[\[(?<actor_name>.*)\]\]  ?dans(?:.*)[:;] ?$/i;
export const isMultiLineLi1_1 =
  /\[\[(?<actor_name>.*)\]\] \(.*\) dans(?:.*)[:;] ?$/i;
export const isMultiLineLi1_2 =
  /\[\[(?<actor_name>.*)\]\] dans \((\d+.*)\)$/i;
export const isMultiLineLi1_3 =
  /\[\[(?<actor_name>.*)\]\] dans [:;] \((\d+.*)\)$/i;
export const isMultiLineLi2 =
  /(?<actor_name>.*) dans(?:.*): ?$/i;
export const isMultiLineLi2_1 =
  /dans ''\[\[(?<media_title>.*)\]\]'' [:;] ?$/i;
export const isMultiLineLi3 =
  /Dans la série ''\[\[(?<media_title>.*)\]\]'' ?$/i;
export const isMultiLineLi4 =
  /\[\[(?<actor_name>.*)\]\] :$/i;
export const isMultiLineLi5 =
  /''\[\[(?<media_title>.*)\]\]'' : ?$/i;
export const isMultiLineLi6 =
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ?$/i;

export const isMultiLineLiRegexes = [
  isMultiLineLi1,
  isMultiLineLi1_1,
  isMultiLineLi1_2,
  isMultiLineLi1_3,
  isMultiLineLi2,
  isMultiLineLi2_1,
  isMultiLineLi3,
  isMultiLineLi4,
  isMultiLineLi5,
  isMultiLineLi6,
]

/** Match a singleline li */
export const singleLineMatcherShow1 = [
  'single line matcher show 1',
  /''\[\[(?<media_title>.*)\]\]'' \((?<year>[\d\-\[\]]+)\) : (?<character_name>.*)/i
]
export const singleLineMatcherShow2 = [
  'single line matcher show 2',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]'' : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow2_5 = [
  'single line matcher show 2_5',
  /(?<year>[\d\-\[\]]+) : \[\[''(?<media_title>.*)''\]\] : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow3 = [
  'single line matcher show 3',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'' :(?: (?<character_name>.*))?/i
]
export const singleLineMatcherShow3_04 = [
  'single line matcher show 3_04',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : '' ?\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*?) \(\[\[(?<actor_name>.*)\]\]\) et (?<character_name_second>.*?) \(\[\[(?<actor_name_second>.*)\]\]\)/i
]
export const singleLineMatcherShow3_05 = [
  'single line matcher show 3_05',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : '' ?\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*?) \(\[\[(?<actor_name>.*)\]\]\) \((?<apparitions>.*?)\]\]\)$/i
]
export const singleLineMatcherShow3_1 = [
  'single line matcher show 3_1',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : '' ?\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow3_5 = [
  'single line matcher show 3_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow4 = [
  'single line matcher show 4',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow4_5 = [
  'single line matcher show 4_5',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]'' : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow13_1 = [
  'single line matcher show 4_6',
  /(?<year>[\d\-\[\]]+) :  ?''(?<media_title>.*)''/i
]
export const singleLineMatcherShow5 = [
  'single line matcher show 5',
  /''(?<year>[\d\-\[\]]+)'' : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow5_1 = [
  'single line matcher show 5_1',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]'' et ''\[\[(?<media_title2>.*)\]\]'' :(?: (?<character_name>.*))?/i
]
export const singleLineMatcherShow6 = [
  'single line matcher show 6',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow6_25 = [
  'single line matcher show 6_25',
  /''\[\[(?<media_title>.*)\]\]'' : (?<year>[\d\-\[\]]+) : (?<character_name>.*) \((?<apparitions>.*[eé]pisode.*)\)/i
]
export const singleLineMatcherShow6_5 = [
  'single line matcher show 6_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[(?<actor_name>.*)\]\] dans ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow6_75 = [
  'single line matcher show 6_75',
  /(?<year>[\d\-\[\]]+) : ''(?<media_title>.*)'' : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow6_77 = [
  'single line matcher show 6_77',
  /''\[\[(?<media_title>.*)\]\]'' : ''\[\[(?<apparitions>.*)\]\]'' : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow6_80 = [
  'single line matcher show 6_80',
  /''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow6_85 = [
  'single line matcher show 6_85',
  /''\[\[(?<media_title>.*)\]\]'' \(''(?<year>[\d\-\[\]]+)'' : (?<character_name>.*) \(\d+.*\) \(actor:(?<actor_name>.*)\)/i
]
export const singleLineMatcherShow6_9 = [
  'single line matcher show 6_9',
  /''(?<media_title>.*)'' : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow7 = [
  'single line matcher show 7',
  /''(?<media_title>.*)'' : (?<character_name>.*) \((?<actor_name>.*)\)/i
]
export const singleLineMatcherShow7_1 = [
  'single line matcher show 7_1',
  /\[\[''(?<year>[\d\-\[\]]+)''\]\] : \[\[''(?<media_title>.*)''\]\] : (?<character_name>.*?)$/i
]
export const singleLineMatcherShow7_2 = [
  'single line matcher show 7_2',
  /''\[\[(?<media_title>.*)\]\]'' +: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow7_5 = [
  'single line matcher show 7_5',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]''\.? : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow7_7 = [
  'single line matcher show 7_7',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]'' : ''\[\[(?<media_title>.*)\]\]''/i
]
export const singleLineMatcherShow7_75 = [
  'single line matcher show 7_75',
  /''\[?\[?(?<year>[\d\- \/\[\]]+)\]?\]?'' : ''\[\[(?<media_title>.*)\]\]'' ?: (?<character_name>.*)/i
]
export const singleLineMatcherShow7_78 = [
  'single line matcher show 7_78',
  /''\[\[(?<year>[\d\-\[\]]+)\]?\]?'''' '': ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow7_8 = [
  'single line matcher show 7_8',
  /''\[\[(?<media_title>.*)\]\]'' ?: (?<character_name>.*)( \((?<apparitions>.*)\))?/i
]
export const singleLineMatcherShow8 = [
  'single line matcher show 8',
  /''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow8_5 = [
  'single line matcher show 8_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\] ?'' : (?<character_name>.*) \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow9 = [
  'single line matcher show 9',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''(?<media_title>.*)'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow9_5 = [
  'single line matcher show 9_5',
  /''\[\[(?<creator_name>.*)\]\] : \[\[(?<media_title>.*)\]\]'' : \[\[(?<character_name>.*)\]\]/i
]
export const singleLineMatcherShow9_55 = [
  'single line matcher show 9_55',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]'' : ''(?<media_title>.*)'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow9_6 = [
  'single line matcher show 9_6',
  /''(?<year>[\d\-\[\]]+)'' : ''(?<media_title>.*)'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow10 = [
  'single line matcher show 10',
  /''(?<media_title>.*)'' : (?<character_name>.*)/i
]
export const singleLineMatcherShow10_5 = [
  'single line matcher show 10_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\],? ?'' \((?<apparitions>.*)\) : (?<character_name>.*) \(\[\[(?<actor_name>.*?)\]\]\)/i
]
export const singleLineMatcherShow11 = [
  'single line matcher show 11',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'',? (?<apparitions>.*) : (?<character_name>.*)/i
]
export const singleLineMatcherShow12 = [
  'single line matcher show 12',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]''/i
]
export const singleLineMatcherShow12_5 = [
  'single line matcher show 12_5',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]''/i
]
export const singleLineMatcherShow12_7 = [
  'single line matcher show 12_7',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\] ?:?'' (?<character_name>.*)$/i
]
export const singleLineMatcherShow13 = [
  'single line matcher show 13',
  /(?<year>[\d\-\[\]]+) : ''(?<media_title>.*)''/i
]
export const singleLineMatcherShow13_5 = [
  'single line matcher show 13_5',
  /(?<character_name>.*?) dans ''\[\[(?<media_title>.*?)\]\]'' \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow14 = [
  'single line matcher show 14',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : (?<actor_name>.*) dans \[\[(?<media_title>.*)\]\] : (?<character_name>.*)/i
]
export const singleLineMatcherShow15_2 = [
  'single line matcher show 15_2',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[(?<media_title>.*)\]\] : (?<character_name>.*)$/i
]
export const singleLineMatcherShow15 = [
  'single line matcher show 15',
  /''\[\[(?<media_title>.*)\]\]'' (?<year>[\d\-\[\]]+) : (?<character_name>.*?) \((?<apparitions>.*)\) \(actor:(?<actor_name>.*)\)/i
]
export const singleLineMatcherShow15_1 = [
  'single line matcher show 15_1',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[''(?<media_title>.*)''\]\] : (?<character_name>.*)$/i
]
export const singleLineMatcherShow16 = [
  'single line matcher show 16',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[''(?<media_title>.*)''\]\]$/i
]
export const singleLineMatcherShow17 = [
  'single line matcher show 17',
  /(?<year>[\d\-\[\]]+) : \[\[''(?<media_title>.*)''\]\] \((?<apparitions>.*)\)/i
]
export const singleLineMatcherShow18 = [
  'single line matcher show 18',
  /(?<year>[\d\-\[\]]+) : \[\[''(?<media_title>.*)''\]\] : (?<character_name>.*)$/i
]
export const singleLineMatcherShow18_5 = [
  'single line matcher show 18_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[(?<actor_name>.*)\]\] dans ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)$/i
]
export const singleLineMatcherShow18_8 = [
  'single line matcher show 18_8',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\) \([ée]p.*\)/i
]
export const singleLineMatcherShow18_9 = [
  'single line matcher show 18_9',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]''$/i
]
export const singleLineMatcherShow19 = [
  'single line matcher show 19',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : (?<media_title>[^']*?) : (?<character_name>.*)$/i
]
export const singleLineMatcherShow19_5 = [
  'single line matcher show 19_5',
  /(?:\[\[)?(?<actor_name>.*?)(?:\]\])? : (?<character_name>.*) dans ''\[\[(?<media_title>.*)\]\]'' ?\(?(?<apparitions>.*)?\)?$/i
]
export const singleLineMatcherShow20 = [
  'single line matcher show 20',
  /(?<year>[\d\-\[\]]+) : \[\[(?<media_title>.*)\]\] : (?<character_name>.*)/i
]
export const singleLineMatcherShow21 = [
  'single line matcher show 21',
  /''\[\[(?<media_title>.*)\]\]'' (?<year>[\d\-\[\]]+) ?: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow21_5 = [
  'single line matcher show 21_5',
  /''\[\[(?<media_title>.*)\]\]''  ?\((?<year>[\d\-\[\]]+)\) ?: (?<character_name>.*)/i
]
export const singleLineMatcherShow22 = [
  'single line matcher show 22',
  /''\[\[(?<media_title>.*)\]\]'' \((?<year>[\d\-\[\]]+) -.*\) : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow22_5 = [
  'single line matcher show 22_5',
  /''\[\[(?<media_title>.*)\]\]'' (?<year>[\d\-\[\]]+) - (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherShow23 = [
  'single line matcher show 23',
  /''\[\[(?<media_title>.*)\]\]'' (?<year>[\d\-\[\]]+) : (?<character_name>.*)/i
]
export const singleLineMatcherShow24 = [
  'single line matcher show 24',
  /(?<year>[\d\-\[\]]+) : \[\[''(?<media_title>.*?)''\]\]$/i
]
export const singleLineMatcherShow25 = [
  'single line matcher show 25',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[(?<media_title>.*)\]\]: (?<character_name>.*)$/i
]
export const singleLineMatcherShow26 = [
  'single line matcher show 26',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[(?<media_title>.*)\]\]/i
]
export const singleLineMatcherShow27 = [
  'single line matcher show 27',
  /''(?<media_title>.*?)'' \(''.*?''\) : (?<character_name>.*?)$/i
]
export const singleLineMatcherShow26_5 = [
  'single line matcher show 26_5',
  /''\[\[(?<media_title>.*?)\]\]'' \(''(?<year>[\d\-\[\]]+)''\) : (?<character_name>.*?) \((?<apparitions>.*?)\)  ?\(actor:(?<actor_name>.*?)\)$/i
]
export const singleLineMatcherShow26_7 = [
  'single line matcher show 26_7',
  /''\[\[(?<media_title>.*?)\]\]'' \(''(?<year>[\d\-\[\]]+)''\) : (?<character_name>.*?) \(actor:(?<actor_name>.*?)\)$/i
]
export const singleLineMatcherShow100 = [
  'single line matcher show 100 - catch all',
  /^''\[\[(?<media_title>.*)\]\]''$/i
]
export const singleLineMatcherShow101 = [
  'single line matcher show 101 - catch all',
  /^''(?<media_title>.*)''$/i
]

export const singlelineMatcherShows = [
  singleLineMatcherShow1,
  singleLineMatcherShow2,
  singleLineMatcherShow2_5,
  singleLineMatcherShow3,
  singleLineMatcherShow3_04,
  singleLineMatcherShow3_05,
  singleLineMatcherShow3_1,
  singleLineMatcherShow3_5,
  singleLineMatcherShow4,
  singleLineMatcherShow4_5,
  singleLineMatcherShow5,
  singleLineMatcherShow5_1,
  singleLineMatcherShow6,
  singleLineMatcherShow6_25,
  singleLineMatcherShow6_5,
  singleLineMatcherShow6_75,
  singleLineMatcherShow6_77,
  singleLineMatcherShow6_80,
  singleLineMatcherShow6_85,
  singleLineMatcherShow6_9,
  singleLineMatcherShow7,
  singleLineMatcherShow7_1,
  singleLineMatcherShow7_2,
  singleLineMatcherShow7_5,
  singleLineMatcherShow7_7,
  singleLineMatcherShow7_75,
  singleLineMatcherShow7_78,
  singleLineMatcherShow7_8,
  singleLineMatcherShow8,
  singleLineMatcherShow8_5,
  singleLineMatcherShow9,
  singleLineMatcherShow9_5,
  singleLineMatcherShow9_55,
  singleLineMatcherShow9_6,
  singleLineMatcherShow10,
  singleLineMatcherShow10_5,
  singleLineMatcherShow11,
  singleLineMatcherShow12,
  singleLineMatcherShow12_5,
  singleLineMatcherShow12_7,
  singleLineMatcherShow13,
  singleLineMatcherShow13_1,
  singleLineMatcherShow13_5,
  singleLineMatcherShow14,
  singleLineMatcherShow15,
  singleLineMatcherShow15_1,
  singleLineMatcherShow15_2,
  singleLineMatcherShow16,
  singleLineMatcherShow17,
  singleLineMatcherShow18_5,
  singleLineMatcherShow18_8,
  singleLineMatcherShow18,
  singleLineMatcherShow18_9,
  singleLineMatcherShow19,
  singleLineMatcherShow19_5,
  singleLineMatcherShow20,
  singleLineMatcherShow21,
  singleLineMatcherShow21_5,
  singleLineMatcherShow22,
  singleLineMatcherShow22_5,
  singleLineMatcherShow23,
  singleLineMatcherShow24,
  singleLineMatcherShow25,
  singleLineMatcherShow26,
  singleLineMatcherShow26_5,
  singleLineMatcherShow26_7,
  singleLineMatcherShow27,
  singleLineMatcherShow100,
  singleLineMatcherShow101,
];

export const singleLineMatcherMovie1 = [
  'movie 1',
  /''\[\[(?<media_title>.*)\]\]'' \((?<year>[\d\-\[\]]+)\) : (?<character_name>.*) \(actor:(?<actor_name>.*)\)/i
]
export const singleLineMatcherMovie1_1 = [
  'movie 1_1',
  /''\[\[(?<media_title>.*)\]\]'' \((?<year>[\d\-\[\]]+)\) : \[\[(?<character_name>.*)\]\]/i
]
export const singleLineMatcherMovie1_2 = [
  'movie 1_2',
  /''\[\[(?<media_title>.*)\]\]'' \((?<year>[\d\-\[\]]+)\) : (?<character_name>.*)/i
]
export const singleLineMatcherMovie1_3 = [
  'movie 1_3',
  /''\[\[(?<media_title>.*)\]\]'' ''\((?<year>[\d\-\[\]]+)\)'' : \[\[(?<character_name>.*)\]\] \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherMovie1_5 = [
  'movie 1_5',
  /''(?<media_title>.*)'' \((?<year>[\d\-\[\]]+)\) : (?<character_name>.*) \(actor:(?<actor_name>.*)\)/i
]
export const singleLineMatcherMovie1_75 = [
  'movie 1_75',
  /''\[\[(?<media_title>.*)\]\]'' \(''(?<year>[\d\-\[\]]+)''\) : (?<character_name>.*?)(?: \(actor:(?<actor_name>.*)\))?$/i
]
export const singleLineMatcherMovie2 = [
  'movie 2',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]'' : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherMovie3 = [
  'movie 3',
  /''(?<year>[\d\-\[\]]+)'' : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*?) \(\[\[(?<actor_name>.*?)\]\]\)/i
]
export const singleLineMatcherMovie4 = [
  'movie 4',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]'' : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherMovie5_5 = [
  'movie 5_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''(?<media_title>.*)'' - .*: (?<character_name>.*)/i
]
export const singleLineMatcherMovie5 = [
  'movie 5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherMovie6 = [
  'movie 6',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]'' :(?: (?<character_name>.*))?/i
]
export const singleLineMatcherMovie7 = [
  'movie 7',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'' :(?: (?<character_name>.*))?/i
]
export const singleLineMatcherMovie7_5 = [
  'movie 7_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'' :(?: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\))?/i
]
export const singleLineMatcherMovie7_8 = [
  'movie 7_8',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'', ''.*'' :(?: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\))?/i
]

export const singleLineMatcherMovie8 = [
  'movie 8',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''(?<media_title>.*)'' :(?: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\))?/i
]
export const singleLineMatcherMovie8_5 = [
  'movie 8_5',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]'' :(?: \[\[(?<character_name>.*)\]\] \(\[\[(?<actor_name>.*)\]\]\))?/i
]
export const singleLineMatcherMovie8_6 = [
  'movie 8_6',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\) et (?<character_name_second>.*) \[\[(?<actor_name_second>.*)\]\]\)/i
]
export const singleLineMatcherMovie9 = [
  'movie 9',
  /(?<year>[\d\-\[\]]+) : ''(?<media_title>.*)'' :(?: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\))?/i
]
export const singleLineMatcherMovie8_75 = [
  'movie 9_5',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]'' :(?: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\))?/i
]
export const singleLineMatcherMovie10 = [
  'movie 10',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]'' de \[\[(?<creator_name>.*?)\]\](?: \(\[\[(?<actor_name>.*)\]\]\) : (?<character_name>.*))?/i
]
export const singleLineMatcherMovie10_5 = [
  'movie 10_5',
  /''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherMovie11 = [
  'movie 11',
  /''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*) \((?<actor_name>.*)\)/i
]
export const singleLineMatcherMovie12 = [
  'movie 12',
  /''\[\[(?<year>[\d\-\[\]]+)\]\]'' : ''\[\[(?<media_title>.*)\]\]''(?: : (?<character_name>.*))?/i
]
export const singleLineMatcherMovie12_5 = [
  'movie 12_5',
  /(?<year>[\d\-\[\]]+) : ''\[\[(?<media_title>.*)\]\]''(?: : (?<character_name>.*))?/i
]
export const singleLineMatcherMovie13 = [
  'movie 13',
  /''(?<year>[\d\-\[\]]+)'' : ''\[\[(?<media_title>.*)\]\]'' de \[\[(?<creator_name>.*?)\]\](?: : \[\[(?<character_name>.*)\]\])? /i
]
export const singleLineMatcherMovie13_5 = [
  'movie 13_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''(?<media_title>.*)'' : (?<character_name>.*)/i
]
export const singleLineMatcherMovie13_75 = [
  'movie 13_75',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\]''/i
]
export const singleLineMatcherMovie13_8 = [
  'movie 13_8',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : *''\[\[(?<media_title>[^'\[].*)\]\]'' : (?<character_name>.*)/i
]
export const singleLineMatcherMovie14 = [
  'movie 14',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : (?<media_title>[^'\[].*) : (?<character_name>.*)/i
]
export const singleLineMatcherMovie14_5 = [
  'movie 14_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[''(?<media_title>.*)''\]\]: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherMovie14_6 = [
  'movie 14_6',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[''(?<media_title>.*)''\]\] : .* : (?<character_name>.*)/i
]
export const singleLineMatcherMovie14_7 = [
  'movie 14_7',
  /\[\[''(?<year>[\d\-\[\]]+)''\]\] : \[\[''(?<media_title>.*)''\]\] : (?<character_name>.*)/i
]
export const singleLineMatcherMovie14_8 = [
  'movie 14_8',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : \[\[''(?<media_title>.*)''\]\] : (?<character_name>.*)/i
]
export const singleLineMatcherMovie15 = [
  'movie 15',
  /(?<year>[\d\-\[\]]+) : \[\[(?<media_title>.*)\]\] : (?<character_name>.*)/i
]
export const singleLineMatcherMovie16 = [
  'movie 16',
  /''\[\[(?<media_title>.*)\]\]'' \((?<year>[\d\-\[\]]+)\) ?-? ? (?<character_name>.*) \(actor:(?<actor_name>.*)\)/i
]
export const singleLineMatcherMovie17 = [
  'movie 17',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*?)\]\]'' \((?<year2>[\d\-\[\]]+)\) : (?<character_name>.*?) \(\[\[(?<actor_name>.*?)\]\]\)/i
]
export const singleLineMatcherMovie18 = [
  'movie 18',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*?)\]\] ?'' ?: (?<character_name>.*) \(\[\[(?<actor_name>.*)\]\]\)/i
]
export const singleLineMatcherMovie19 = [
  'movie 19',
  /''\[\[(?<media_title>.*)\]\]'' \((?<year>[\d\-\[\]]+)\) et ''\[\[(?<second_media_title>.*)\]\]'' : .*\[\[(?<character_name>.*)\]\]/i
]
export const singleLineMatcherMovie20 = [
  'movie 20',
  /(?<year>[\d\-\[\]]+) :  ?''(?<media_title>.*)''/i
]
export const singleLineMatcherMovie20_5 = [
  'movie 20_5',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*?)\]\]'' d'\[\[(?<creator_name>.*?)\]\] : (?<character_name>.*?) \(\[\[(?<actor_name>.*?)\]\]\)/i
]
export const singleLineMatcherMovie21 = [
  'movie 21',
  /\[\[(?<year>[\d\-\[\]]+)\]\] : ''\[\[(?<media_title>.*)\]\](?:'')? : (?<character_name>.*)/i
]
export const singleLineMatcherMovie100 = [
  'movie 100',
  /''\[\[(?<media_title>.*)\]\]'' : (?<character_name>.*?)$/i
]

export const singlelineMatcherMovie = [
  singleLineMatcherMovie1,
  singleLineMatcherMovie1_1,
  singleLineMatcherMovie1_2,
  singleLineMatcherMovie1_3,
  singleLineMatcherMovie1_5,
  singleLineMatcherMovie1_75,
  singleLineMatcherMovie2,
  singleLineMatcherMovie3,
  singleLineMatcherMovie4,
  singleLineMatcherMovie5,
  singleLineMatcherMovie5_5,
  singleLineMatcherMovie6,
  singleLineMatcherMovie7,
  singleLineMatcherMovie7_5,
  singleLineMatcherMovie7_8,
  singleLineMatcherMovie8,
  singleLineMatcherMovie8_5,
  singleLineMatcherMovie8_6,
  singleLineMatcherMovie8_75,
  singleLineMatcherMovie9,
  singleLineMatcherMovie10,
  singleLineMatcherMovie10_5,
  singleLineMatcherMovie11,
  singleLineMatcherMovie12,
  singleLineMatcherMovie12_5,
  singleLineMatcherMovie13,
  singleLineMatcherMovie13_5,
  singleLineMatcherMovie13_75,
  singleLineMatcherMovie13_8,
  singleLineMatcherMovie14,
  singleLineMatcherMovie14_5,
  singleLineMatcherMovie14_6,
  singleLineMatcherMovie14_7,
  singleLineMatcherMovie14_8,
  singleLineMatcherMovie15,
  singleLineMatcherMovie16,
  singleLineMatcherMovie17,
  singleLineMatcherMovie18,
  singleLineMatcherMovie19,
  singleLineMatcherMovie20,
  singleLineMatcherMovie20_5,
  singleLineMatcherMovie21,
  singleLineMatcherMovie100,
];

export const singleLineMatcherGeneric1 = [
  'single line matcher generic 1',
  /(?:(?<year>\d{4}): )?<a href="(.*?)" title="(?<media_title2>.*?)">(?<media_title>.*?)<\/a>$/i
]

export const singleLineMatcherGeneric2 = [
  'single line matcher generic 2',
  /(?:(?<year>\d{4}): )?(?<media_title>.*?): (?<character_name>.*?)$/i
]

export const singleLineMatcherGeneric3 = [
  'single line matcher generic 3',
  /voix ?(off)? ?(dans|sur|du|occasionnelle)?(?<match>.*?)$/i
]
export const singleLineMatcherGeneric4 = [
  'single line matcher generic 3',
  /(?<match>International Standard Book Number|Livre|Roman|[eé]ditions)/i
]

export const singleLineMatcherGeneric = [
  singleLineMatcherGeneric1,
  singleLineMatcherGeneric2,
  singleLineMatcherGeneric3,
  singleLineMatcherGeneric4,
]

export const singlelineMatcherVideoGame1 = [
  'single line matcher video game 1',
  /<a href="(.*?)" title="(.*?)">(?<year>\d{4})<\/a>: <a href="(.*?)" title="(?<media_title2>.*?)">(?<media_title>.*?)<\/a>(: (?<character_name>.*?))?$/i
]

export const singlelineMatcherVideoGame = [
  singlelineMatcherVideoGame1,
]

export const matchersSingleLineByType: Record<ElementType, (string | RegExp)[][]> = {
  generic: singleLineMatcherGeneric,
  movie: singlelineMatcherMovie,
  show: singlelineMatcherShows,
  videogame: singlelineMatcherVideoGame,
}

export const preProcess: Array<[string, RegExp, string]> = [
  // name, regex, replace
  ['sup', /(<sup(.*?)<\/sup>)/gi, ''],
  ['citation', / ?<span class="citation">(.*?) ?<\/span>/gi, ''],
  ['abbr', / ?<abbr class="abbr" title="(.*?)">(.*?)<\/abbr> ?/gi, ' $1 '],
  ['indicateur-langue', /<span(.*?)class="indicateur-langue"(.*)<\/span>/gi, ''],
  ['small mini show', /<small>\(mini-série\)<\/small>/gi, ''],
  ['small', /<small>(?<match>.*?)<\/small>/gi, '$<match>'],
  ['nbsp', /&nbsp;/gi, ''],
  ['class_nw-redirect', /class="mw-redirect" /gi, ''],
  ['class_new', /class="new" /gi, ''],
  ['extiw', /<a[^>]*extiw[^>]*>(.*?)<\/a>/gi, '$1'],
  ['i', /<i>(.*?)<\/i>/gi, '$1'],
  ['lang', /<span class="lang-.*?"(?:.*?)>(.*?)<\/span>/gi, '$1'],
  ['link', /<a (.*?)>(?<match>.*?)<\/a>/gi, '"$<match>"'],
  ['voix additionnelles', /( ?:?(?:et ?)? voix additionnelles?)/gi, ''],
  ['voix de remplacement', /(\(voix de remplacement\)) ?/gi, ''],
  ['voix de remplacement', /(voix de remplacement, )/gi, ''],
  ['voix de remplacement', /(\(voix de remplacement( : .*)\)) ?/gi, ''],
  ['autres personnages', /((?: ?et)? ?autres personnage?s)/gi, ''],
  ['premiere voix', /\(((?<name>.*?), Première voix)\)/gi, '($<name>)'],
  ['premiere voix2', / \(( Première voix)\)/gi, ''],
  ['deuxieme voix', /\( ?Deuxième voix\) ?/gi, ''],
  ['voix animator', /\( ?voix animateur\) ?/gi, ''],
  ['voix', / \( ?voix\) ?/gi, ''],
  ['deuxieme doublage', / \( ? Deuxième doublage\) ?/gi, ''],
  ['premier doublage', / \( ? premier doublage\) ?/gi, ''],
  ['premier doublage', / \(premier doublage\) ?/gi, ''],
  ['troisieme voix', /\( ?Troisième voix\) ?/gi, ''],
  ['acteur', / \(acteur\)/gi, ''],
  ['vf', / \(version française\)/gi, ''],
  ['vf', / \(voix française\)/gi, ''],
  ['voice creation', / \(création de voix\)/gi, ''],
  ['actor year', / (\(acteur, \d+\))/gi, ''],
  ['tvshow', / \(série télévisée\)/gi, ''],
  ['tvshow', / \(série d'animation\)/gi, ''],
  ['tvshow', / \(série documentaire\)/gi, ''],
  ['short', / \(court métrage\)/gi, ''],
  ['jeune et âgée', / \(jeune et âgée\)/gi, ''],
  ['<s>', /<s>(.*)<\/s>/gi, '$1'],
  ['doublage', / +(\(doublage en .*\))/gi, ''],
  ['doublage', / +(\(doublage .*\))/gi, ''],
  ['voix off', / \("voix off"\)/gi, ''],
  ['dialogues', / \(dialogues\)/gi, ''],
  ['documentaire', / \(documentaire\)/gi, ''],
  ['non crédité', / \(non crédité\)/gi, ''],
  ['docu', / \(film documentaire\)/gi, ''],
  ['chant', / \(chant\)/gi, ''],
  ['voice', / \(voix - doublage alternatif\)/gi, ''],
  ['voix parlée', / \(voix parlée\)/gi, ''],
  ['scènes coupées', / \(scènes coupées\)/gi, ''],
  ['court-métrage', / \(court-métrage\)/gi, ''],
  ['animation', / \(animation\)/gi, ''],
  ['arte', / - \"Arte\"/gi, ''],
  ['arte', / - Arte junior/gi, ''],
  ['&', /&amp;/gi, '&'],
  ['display:none', /<span.*display:none.*>(.*)<\/span>/gi, ''],
  ['nowrap', /<span class="nowrap">(.*)<\/span>/gi, '$1'],
  ['header', /[^\w]=+? ?.* ?=+? *[^\w]/gi, ''],
  ['a dater', /{{à dater\|.*}}/gi, ''],
  ['columnStart', /{{début de colonnes\|.*(?:}})/gi, ''],
  ['ref', /<ref.*?(?:(?:<\/ref)|(?:\/))>/gi, ''],
  ['oav', / ?\(OAV.*?\)/gi, ''],
  ['colonnes', /{{Colonnes.*$/gi, ''],
  ['}}', /^}}$/gi, ''],
  // [[xxxx|yyyy]] or [[yyyy]]
  ['link with name', /\[\[(?:([^\]]*)\|)?(.+?)\]\]/gi, '[[$2]]'],
  ['correct template 1', /\b\]\] :'' \b/gi, ']]\'\' : '],
  ['refnec', /{{refnec\|(.*)\|.*$/gi, '$1'],
  ['lien', /{{lien\|lang(?:.*?)\|fr=(.*?)}}/gi, '$1'],
  ['lien', /{{lien\|langue=(?:.*?)\|trad=(?:.*?)\|fr=(.*?)}}/gi, '$1'],
  ['lien', /{{lien\|lang=(?:.*)\|trad=(?:.*)\|fr=(.*?)}}/gi, '$1'],
  ['lien', /{{lien\|langue=(?:.*)\|trad=(.*)}}/gi, '$1'],
  ['lien', /{{lien\|langue=(?:.*)\|(.*)}}/gi, '$1'],
  ['lien', /{{lien\|(.*?)}}/gi, '[[$1]]'],
  ['fix space', /(\b\(\[)/gi, ' $1'],
  ['remove trailing dot', /\.$/gi, ''],
  // ['remove trailing colon', / ?:$/gi, ''],
  ['remove trailing stars', /^(\*+) +/gi, ''],
  ['Arte', / \(\[?\[?Arte\]?\]?\)/gi, ''],
  ['remove', /Les dates en italique correspondent aux sorties initiales des films dont Jean-Luc Kayser a assuré le redoublage/gi, ''],
  ['fix date range', /(\[\[.*?\]\]) ?- ?(\[\[.*?\]\])/gi, '$1-$2'],
  ['fix date range', /\((\d+) ?- ?(\d+)\)/gi, '$1-$2'],
  ['x voice', / ?\({{.*\|voix}}\)/gi, ''],
  ['x voice', / ?\({{.*\|voix}}, (.*)\)/gi, ' ($1)'],
  ['x voice', / ?\({{2e\|.*}} en.*\)/gi, ''],
  ['html comment', /<!--.*-->/gi, ''],
  ['fin de colonnes', /{{fin de colonnes(\|nombre=2)?}}/gi, ''],
  ['{{,}}', /{{,}}/gi, ''],
  ['dates', /''(\d+)''-''(\d+)''/gi, '[[$1-$2]]'],
  ['section à sourcer', /{{section à.*}}/gi, ''],
  ['xe', /{{(\d+e)}}/gi, '$1'],
  ['xe doublage', /\({{\d+e\|doublage}}\)/gi, ''],
  ['remove', /une multi.*$/gi, ''],
  ['telefilm', / ?\(téléfilm\)/gi, ''],
  ['lang', /{{lang.*\|(\[\[.*\]\])}}/gi, '$1'],
  ['also', /Mais aussi :/gi, ''],
  ['saut', /{{saut\|\d+em}}/gi, ''],
  ['extra space', /'' \[\[/gi, '\'\'[['],
  ['extra space', /\]\] ''/gi, ']]\'\''],
  ['string', /il a également.*série.*$/gi, ''],
  ['mini-série', / ?\(\[\[mini-s[ée]rie\]\]\)/gi, ''],
  ['skip', /\[\[2010\]\] : ''\[\[The Bridge\]\]'' : Carl Harbin.*/gi, ''],
  ['skip', /\[\[2013]] : ''\[\[Arrested Development]]'' : l'acteur gay.*/gi, ''],
  ['skip', /\[\[2017]] : ''\[\[In the Dark]]'' : Patrick Rushton.*/gi, ''],
  ['skip', /2003-2009 : le mythe-Webster \(\[\[Ronald Pickup]]\).*/gi, ''],
  ['skip', /il est également.*$/gi, ''],
  ['rm', /{{saut\|.*?}}/gi, ''],
  ['lang', /{{langue\|.*?\|(.*)}}/gi, '$1'],
  ['weird char', / /gi, ' '],
  ['docu-fiction', / \(\[\[docu-fiction\]\] de .*\)/gi, ''],
  ['cameo', / \(\[\[cam[eé]o\]\]\)/gi, ''],
  ['space', /\*(\d+)/gi, '$1'],
  ['lang', /\[\[lang=.*?\|trad=.*?\|texte={{lang\|.*?\|(.*)\]\]}}/gi, '$1'],
  ['quotes', /"\[\[/gi, '\'\''],
  ['quotes', /\]\]"/gi, '\'\''],
  ['skip', /engagé par les(.*)$/gi, ''],
  ['skip', /.*en alternance avec.*/gi, ''],
  ['skip', /{{Section vide ou incomplète}}/gi, ''],
  ['skip', /Elle est la voix.*/gi, ''],
]

export const postProcess: Array<[string, RegExp, string]> = [
  // name, regex, replace
  ['quotes', /"(?<match>.*?)"/gi, '$<match>'],
  ['remove trailing colon', / ?:$/gi, ''],
  ['year', /\[\[(\d+)\]\]/gi, '$1'],
  ['year', /\]\]-\[\[/gi, '-'],
  ['year', /\]?\]? \/ \[?\[?/gi, '-'],
  ['year', /\]\]-/gi, '-'],
]

const yearMatcher = [
  /\d+/,
  /\"\d+\"/,
  /\"\d+\"-\"\d+\"/,
  /\"\d+\"-\d+/,
  /\d+-\"\d+\"/,
]

export type RegexGroupKeys =
  | 'actor_link0'
  | 'actor_link'

  | 'actor_name0'
  | 'actor_name'
  | 'actor_name2'

  | 'actor_second_name'

  | 'character_name'
  | 'character_name2'
  | 'character_second_name'

  | 'media_title0'
  | 'media_title'
  | 'media_title2'
  | 'media_title3'
  | 'media_link'

  | 'year0'
  | 'year'

  | 'apparitions0'
  | 'apparitions'

  | 'li_body'

  | 'match'

export const HTMLTagRegex = /<[^>]*>/