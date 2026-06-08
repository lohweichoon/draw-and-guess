export const WORDS_ZH = [
  // 动物
  "猫", "狗", "兔子", "熊猫", "老虎", "大象", "长颈鹿", "企鹅", "鲨鱼", "蝴蝶",
  "青蛙", "蜜蜂", "螃蟹", "乌龟", "鹦鹉", "狮子", "斑马", "章鱼", "蜗牛", "松鼠",
  // 食物
  "苹果", "香蕉", "西瓜", "草莓", "汉堡", "披萨", "寿司", "冰淇淋", "蛋糕", "饺子",
  "面条", "炒饭", "烤鸭", "火锅", "包子", "月饼", "芒果", "菠萝", "葡萄", "樱桃",
  // 交通
  "汽车", "飞机", "火车", "自行车", "摩托车", "轮船", "直升机", "热气球", "潜水艇", "拖拉机",
  // 日常物品
  "手机", "电脑", "眼镜", "雨伞", "书包", "钥匙", "剪刀", "蜡烛", "灯泡", "镜子",
  "闹钟", "风扇", "冰箱", "洗衣机", "电视", "钢笔", "足球", "吉他", "钢琴", "帽子",
  // 自然
  "太阳", "月亮", "星星", "彩虹", "闪电", "雪花", "火山", "海浪", "树木", "花朵",
  "云朵", "山峰", "河流", "沙漠", "仙人掌",
  // 人物/职业
  "厨师", "医生", "老师", "警察", "消防员", "宇航员", "魔术师", "运动员",
  // 建筑/地点
  "城堡", "教堂", "灯塔", "摩天轮", "金字塔", "长城", "埃菲尔铁塔",
  // 动作
  "跳舞", "游泳", "打篮球", "唱歌", "钓鱼", "骑马", "爬山", "射箭",
]

export function getRandomWord(): string {
  return WORDS_ZH[Math.floor(Math.random() * WORDS_ZH.length)]
}

export function getWordHint(word: string): string {
  return Array.from(word).join('  ')
    .replace(/[一-龥]/g, '_')
    .split('  ')
    .join('  ')
}

// Returns hint with some chars revealed based on time passed
export function getRevealedHint(word: string, revealCount: number): string {
  const chars = Array.from(word)
  const indices = [...Array(chars.length).keys()]
  // Shuffle indices to reveal random characters
  const shuffled = indices.sort(() => Math.random() - 0.5)
  const toReveal = new Set(shuffled.slice(0, revealCount))
  return chars.map((c, i) => toReveal.has(i) ? c : '_').join('  ')
}
