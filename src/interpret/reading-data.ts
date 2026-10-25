// 现代白话解读文本库（本项目整理，非古籍原文）。每条都是“较有可能”口吻的取象，用于把盘面信息写成连贯的解读。
// 这些文字由项目作者撰写，状态为“未审核”；古籍中的原始说法见各星曜、十神的规则条目（出处折叠里）。
export type Tag = 'think' | 'lead' | 'act' | 'gentle' | 'creative' | 'social' | 'steady' | 'money' | 'support' | 'change';
export const TAG_LABEL_ZH: Record<Tag, string> = {
  think: '爱思考、重分析', lead: '想站在主导的位置', act: '行动果断、敢闯', gentle: '温和、重感受', creative: '有表达与创造的冲动',
  social: '重人际与交往', steady: '稳健务实', money: '重现实收益', support: '愿意照应、辅佐别人', change: '不愿墨守成规、喜欢变化',
};
export interface StarReading { style: string; gift: string; watch: string; tags: Tag[] }
export const STAR_READING: Record<string, StarReading> = {
  紫微: { style: '想站在主导的位置，重视格局与体面', gift: '有统筹与承担的气质，容易让人信服', watch: '放不下面子，对身边人的要求容易偏高', tags: ['lead'] },
  天机: { style: '凡事先动脑，喜欢分析、规划和随机应变', gift: '反应快、点子多、学习力强', watch: '想得多、行动容易摇摆，也容易焦虑', tags: ['think'] },
  太阳: { style: '热心外放，愿意为别人出力，也在意名声与认可', gift: '光明坦率，有感染力', watch: '容易操心过度，不太会照顾自己', tags: ['lead', 'social'] },
  武曲: { style: '务实果断，看重结果与实际收益', gift: '执行力强，责任感和理财意识好', watch: '说话偏直、偏刚硬，不太会示弱', tags: ['act', 'money'] },
  天同: { style: '随和平稳，看重生活的舒适与和气', gift: '好相处，遇事的反应比较柔和', watch: '容易安于现状、拖延', tags: ['gentle'] },
  廉贞: { style: '有自己的原则，也有较强的情感与欲望，做事有一套', gift: '有魅力、有韧性、敢作敢当', watch: '情绪与人际界线容易拉扯', tags: ['social', 'lead'] },
  天府: { style: '稳健守成，擅长积累和管理资源', gift: '有包容力，持家理财的能力较好', watch: '偏保守，不太愿意冒险', tags: ['steady', 'money'] },
  太阴: { style: '细腻内敛，看重感受、家庭与安全感', gift: '体贴、有审美、有耐心', watch: '情绪起伏较大，容易多愁', tags: ['gentle', 'think'] },
  贪狼: { style: '兴趣广泛，善于交际，追求体验与机会', gift: '灵活有魅力，多才多艺', watch: '容易分心，想要的东西较多', tags: ['social', 'creative'] },
  巨门: { style: '爱探究、讲道理，口才与分析见长', gift: '洞察力强，表达有力', watch: '容易挑剔、多疑，也容易有口舌上的摩擦', tags: ['think'] },
  天相: { style: '稳重讲信用，擅长辅佐与协调', gift: '公正、懂分寸、愿意照应别人', watch: '顾虑他人太多，有时缺乏主见', tags: ['support', 'steady'] },
  天梁: { style: '有长者风范，爱照顾人，讲原则', gift: '稳重，能化解问题，较容易遇到贵人', watch: '容易说教、爱管事', tags: ['support', 'steady'] },
  七杀: { style: '果敢独立，敢冲敢闯，不喜欢被约束', gift: '魄力强、执行快、抗压', watch: '性子急，容易硬碰硬', tags: ['act', 'lead'] },
  破军: { style: '不满足于现状，喜欢破旧立新、尝试变化', gift: '开拓力强，勇于改变', watch: '起伏较大，不易守成', tags: ['change', 'act'] },
};
export const GOD_READING: Record<string, { text: string; tags: Tag[] }> = {
  比肩: { text: '自主、重平等，习惯靠自己，也看重同伴', tags: [] },
  劫财: { text: '好胜、愿意冒险，也容易在竞争与花销上用力', tags: ['act', 'social'] },
  食神: { text: '轻松随性、会享受生活，愿意表达与创作', tags: ['creative', 'gentle'] },
  伤官: { text: '才华外露、有个性，爱表达，也爱挑战既有的规矩', tags: ['creative', 'think'] },
  偏财: { text: '善于交际、把握机会，花钱也比较大方', tags: ['social', 'money'] },
  正财: { text: '务实稳定，重规则，靠踏实积累', tags: ['steady', 'money'] },
  正官: { text: '守规矩、重责任与名誉，愿意被组织与规范接纳', tags: ['steady', 'lead'] },
  七杀: { text: '有压力感也有魄力，敢扛事，喜欢挑战', tags: ['act', 'lead'] },
  正印: { text: '重学习、受人照应，温和有涵养', tags: ['think', 'support'] },
  偏印: { text: '偏思考型，爱钻研，想法独特，较有可能想得比做得多', tags: ['think'] },
};
/** 某类十神完全没有出现时的说法 */
export const GOD_ABSENT: Record<string, string> = {
  比劫: '八字里没有比肩、劫财，同类的助力较少，较有可能更习惯独立承担、少依赖同伴。',
  食伤: '八字里没有食神、伤官，表达与创作的“出口”不被强调，较有可能更偏内敛、含蓄。',
  财: '八字里没有财星。现代命理常把这理解为对金钱的态度较随性，财运更多靠大运、流年的补入；紫微的财帛宫另有看法，两者并不一定一致。',
  官杀: '八字里没有正官、七杀，较少被规则和外部压力推着走，较自由，也可能少了一点“被要求”的推动力。',
  印: '八字里没有印星，较少有来自长辈、学习资源的庇护感，较有可能更靠自己摸索。',
};
export const GOD_PHASE: Record<string, string> = {
  比肩: '同伴、合作与自立', 劫财: '竞争、花销与人际拉扯', 食神: '较轻松、重表达与享受生活', 伤官: '表达欲强、想创新、不愿守旧',
  偏财: '机会、人脉与流动资金', 正财: '踏实积累、稳定收入', 正官: '责任、职位与规范', 七杀: '压力与挑战、需要魄力',
  正印: '学习、受照应、进修', 偏印: '独处、钻研与转型思考',
};
export const TRANSFORM_PHASE: Record<string, string> = {
  禄: '较有机会、事情比较顺手', 权: '较想主动掌控、愿意承担', 科: '较容易得到肯定或贵人相助', 忌: '容易纠结、需要多费心，值得多留意',
};
/** 宫位的提问方式 */
export const PALACE_FRAME: Record<string, string> = {
  官禄: '事业上', 财帛: '金钱与理财上', 夫妻: '感情与伴侣关系中', 子女: '和晚辈、创作成果的关系上', 田宅: '对家与居所', 福德: '内心世界里', 疾厄: '生活节奏与身体感受上', 父母: '和长辈、文书事务上',
};
