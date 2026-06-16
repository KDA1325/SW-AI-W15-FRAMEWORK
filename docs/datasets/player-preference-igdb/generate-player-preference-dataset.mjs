import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_AT = '2026-06-17T00:00:00+09:00';
const DATASET_BASENAME = 'player_preference_igdb_reviews_journals';
const PERSONA_OUTPUT_DIR = 'by-persona';

const preferenceScale = {
  LIKE: {
    label: 'positive_preference',
    scores: [0.78, 0.84, 0.9, 0.95],
    reviewRatings: [4.2, 4.5, 4.8, 5.0],
  },
  MIXED: {
    label: 'mixed_preference',
    scores: [0.08, 0.18, 0.28],
    reviewRatings: [3.0, 3.2, 3.5],
  },
  DISLIKE: {
    label: 'negative_preference',
    scores: [-0.72, -0.66, -0.58],
    reviewRatings: [1.4, 1.8, 2.2],
  },
};

const profiles = [
  {
    id: 'rpg_sim_solo',
    name: 'RPG/시뮬레이션 솔로 선호 플레이어',
    expectedCount: 40,
    dominantKeywords: [
      'SOLO_PLAY',
      'RPG',
      'SIMULATION',
      'STORY_RICH',
      'RELAXED_GRIND',
      'EXPLORATION',
    ],
    positiveFrame:
      '혼자 목표를 세우고 캐릭터나 생활 루프를 천천히 키우는',
    journalFrame:
      '퀘스트, 수집, 장비 성장, 반복 작업이 내 리듬으로 이어지는',
    avoidanceKeywords: [
      'RANKED_STRESS',
      'TEAM_DEPENDENCY',
      'HIGH_APM',
      'SHORT_MATCH_LOOP',
    ],
    games: [
      e('VRChat', 'vrchat', 'LIKE', ['Simulator', 'Adventure'], ['Online Co-Op', 'Multiplayer'], '아바타와 월드 탐색이 생활형 루틴처럼 이어진다', '낯선 방에서는 소셜 피로가 조금 생긴다', ['AVATAR_CUSTOMIZATION', 'SOCIAL_SANDBOX', 'EXPLORATION']),
      e('Hogwarts Legacy', 'hogwarts-legacy', 'LIKE', ['RPG', 'Adventure'], ['Single player'], '학교를 돌아다니며 주문과 장비를 모으는 진행이 안정적이다', '오픈월드 체크리스트가 가끔 반복적으로 느껴진다', ['FANTASY_RPG', 'STORY_RICH', 'COLLECTION']),
      e('Euro Truck Simulator 2', 'euro-truck-simulator-2', 'LIKE', ['Simulator', 'Indie'], ['Single player'], '운전, 배송, 차고 확장이 조용한 몰입감을 만든다', '긴 이동이 맞지 않는 날에는 템포가 느리다', ['DRIVING_SIM', 'RELAXED_GRIND', 'MANAGEMENT']),
      e('NieR Replicant ver.1.22474487139...', 'nier-replicant-ver-1-22474487139', 'LIKE', ['RPG', 'Adventure'], ['Single player'], '서사와 음악이 반복 플레이의 의미를 바꿔 준다', '반복 구간이 길게 느껴질 때가 있다', ['STORY_RICH', 'MELANCHOLY', 'ACTION_RPG']),
      e('Monster Hunter: World', 'monster-hunter-world', 'LIKE', ['RPG', 'Adventure'], ['Single player', 'Co-op'], '장비 제작과 몬스터 패턴 학습이 긴 성장 루프를 만든다', '멀티 압박보다 솔로 연습 시간이 더 필요하다', ['CRAFTING', 'BOSS_HUNT', 'GEAR_PROGRESSION']),
      e('Monster Hunter Rise', 'monster-hunter-rise', 'LIKE', ['RPG', 'Adventure'], ['Single player', 'Co-op'], '짧은 사냥과 장비 갱신이 부담 없는 반복 목표를 준다', '속도감이 빨라 초반에는 조작이 바쁘다', ['ACTION_RPG', 'CRAFTING', 'COLLECTION']),
      e('DJMax Respect V', 'djmax-respect-v', 'LIKE', ['Music', 'Arcade'], ['Single player', 'Multiplayer'], '곡 해금과 판정 향상이 혼자 연습하기 좋다', '경쟁 랭킹을 의식하면 피로도가 오른다', ['RHYTHM', 'SKILL_GROWTH', 'SOLO_PRACTICE']),
      e('House Flipper', 'house-flipper', 'LIKE', ['Simulator', 'Indie'], ['Single player'], '청소, 수리, 인테리어가 눈에 보이는 성취로 쌓인다', '큰 집을 반복 청소할 때는 단조롭다', ['RENOVATION', 'COZY_SIM', 'CREATIVE']),
      e('Stardew Valley', 'stardew-valley', 'LIKE', ['RPG', 'Simulator'], ['Single player', 'Co-op'], '농사와 관계 성장, 채집이 하루 단위 목표로 잘게 나뉜다', '축제 일정이 겹치면 효율을 고민하게 된다', ['LIFE_SIM', 'FARMING', 'RELAXED_GRIND']),
      e('The Elder Scrolls V: Skyrim', 'the-elder-scrolls-v-skyrim', 'LIKE', ['RPG', 'Adventure'], ['Single player'], '역할극과 탐험이 정해진 루트 없이 이어진다', '퀘스트 로그가 너무 커지면 집중이 흐려진다', ['OPEN_WORLD_RPG', 'ROLEPLAY', 'EXPLORATION']),
      e('Persona 5 Royal', 'persona-5-royal', 'LIKE', ['RPG', 'Adventure'], ['Single player'], '일상 스케줄과 던전 공략이 캐릭터 성장으로 묶인다', '긴 대화가 피곤한 날에는 진행 속도가 느리다', ['JRPG', 'SOCIAL_LINK', 'TURN_BASED']),
      e('The Witcher 3: Wild Hunt', 'the-witcher-3-wild-hunt', 'LIKE', ['RPG', 'Adventure'], ['Single player'], '선택지와 서브 퀘스트가 여행 기록처럼 남는다', '전투보다 서사를 따라갈 때 더 즐겁다', ['STORY_RICH', 'OPEN_WORLD_RPG', 'QUESTING']),
      e('Cyberpunk 2077', 'cyberpunk-2077', 'LIKE', ['RPG', 'Shooter'], ['Single player'], '빌드 선택과 도시 탐사가 캐릭터 취향을 드러낸다', '총격 위주 임무는 오래 하면 피로하다', ['BUILD_CRAFTING', 'NARRATIVE', 'EXPLORATION']),
      e('Dragon Quest XI S: Echoes of an Elusive Age', 'dragon-quest-xi-s-echoes-of-an-elusive-age-definitive-edition', 'LIKE', ['RPG'], ['Single player'], '전통적인 파티 성장과 밝은 모험 구조가 편안하다', '예상 가능한 전개가 가끔 무난하게 느껴진다', ['JRPG', 'PARTY_GROWTH', 'COMFORT_PLAY']),
      e('Atelier Ryza: Ever Darkness & the Secret Hideout', 'atelier-ryza-ever-darkness-and-the-secret-hideout', 'LIKE', ['RPG'], ['Single player'], '채집과 연금술 조합이 생활형 제작 루프로 이어진다', '소재 관리가 과해지면 메뉴 시간이 길다', ['CRAFTING', 'JRPG', 'ITEM_SYNTHESIS']),
      e('PowerWash Simulator', 'powerwash-simulator', 'LIKE', ['Simulator', 'Indie'], ['Single player', 'Co-op'], '오염이 사라지는 피드백이 명확해서 집중하기 쉽다', '서사적 목표는 약하다', ['CLEANING_SIM', 'RELAXED', 'TASK_COMPLETION']),
      e('Car Mechanic Simulator 2021', 'car-mechanic-simulator-2021', 'LIKE', ['Simulator'], ['Single player'], '분해와 수리 절차가 차근차근 배우는 재미를 준다', '부품 찾기가 반복되면 루틴이 무거워진다', ['MECHANIC_SIM', 'MANAGEMENT', 'SYSTEM_LEARNING']),
      e('Farming Simulator 22', 'farming-simulator-22', 'LIKE', ['Simulator'], ['Single player', 'Co-op'], '농기계 운용과 생산 계획이 느긋한 목표감을 만든다', '초반 진입 장벽이 조금 높다', ['FARMING_SIM', 'ECONOMY', 'LONG_TERM_GOALS']),
      e('My Time at Portia', 'my-time-at-portia', 'LIKE', ['RPG', 'Simulator'], ['Single player'], '마을 의뢰와 제작 설비 확장이 꾸준히 보상을 준다', '동선 반복은 취향을 탈 수 있다', ['LIFE_SIM', 'CRAFTING', 'TOWN_RELATIONSHIP']),
      e('No Man\'s Sky', 'no-mans-sky', 'LIKE', ['Simulator', 'Adventure'], ['Single player', 'Multiplayer'], '행성 탐사와 기지 건설이 나만의 여행감을 만든다', '목표가 넓어서 스스로 계획을 잡아야 한다', ['EXPLORATION', 'BASE_BUILDING', 'SANDBOX']),
      e('Death Stranding', 'death-stranding', 'LIKE', ['Adventure', 'Simulator'], ['Single player'], '배송 루트 설계와 지형 극복이 묵직한 몰입을 준다', '초반 설명과 컷신은 길게 느껴진다', ['DELIVERY_SIM', 'ATMOSPHERIC', 'ROUTE_PLANNING']),
      e('Spiritfarer', 'spiritfarer', 'LIKE', ['Simulator', 'Adventure'], ['Single player', 'Co-op'], '배를 관리하며 인물의 마지막 이야기를 돌보는 과정이 좋다', '감정선이 무거워 오래 이어 하기는 어렵다', ['COZY_MANAGEMENT', 'STORY_RICH', 'EMOTIONAL']),
      e('Dave the Diver', 'dave-the-diver', 'LIKE', ['RPG', 'Simulator'], ['Single player'], '잠수 탐사와 식당 운영이 번갈아 돌아와 지루하지 않다', '미니게임이 많아 산만하게 느껴질 때가 있다', ['MANAGEMENT', 'EXPLORATION', 'COLLECTION']),
      e('Slime Rancher', 'slime-rancher', 'LIKE', ['Simulator', 'Adventure'], ['Single player'], '슬라임 수집과 목장 확장이 귀엽고 명확한 목표를 준다', '위험 요소가 낮아 긴장감은 적다', ['CREATURE_COLLECTION', 'COZY_SIM', 'BASE_EXPANSION']),
      e('Graveyard Keeper', 'graveyard-keeper', 'LIKE', ['RPG', 'Simulator'], ['Single player'], '제작 트리와 묘지 운영이 어두운 생활 시뮬레이션으로 맞물린다', '시스템 설명이 부족해 초반이 막힌다', ['CRAFTING', 'MANAGEMENT', 'DARK_HUMOR']),
      e('Rune Factory 4 Special', 'rune-factory-4-special', 'LIKE', ['RPG', 'Simulator'], ['Single player'], '농사와 던전, 주민 관계가 한 캐릭터 성장으로 합쳐진다', '반복 전투가 단순하게 느껴질 때가 있다', ['FARMING_RPG', 'RELATIONSHIP', 'DUNGEON']),
      e('Cities: Skylines', 'cities-skylines', 'LIKE', ['Simulator', 'Strategy'], ['Single player'], '도로와 구역을 조정하며 도시가 살아나는 과정이 재밌다', '문제가 한꺼번에 터지면 피로감이 커진다', ['CITY_BUILDER', 'SYSTEMS', 'PLANNING']),
      e('Elite Dangerous', 'elite-dangerous', 'LIKE', ['Simulator', 'Adventure'], ['Single player', 'Multiplayer'], '우주 항해와 거래 루틴이 느린 몰입에 잘 맞는다', '조작과 정보량이 많아 적응 시간이 필요하다', ['SPACE_SIM', 'TRADING', 'EXPLORATION']),
      e('Elden Ring', 'elden-ring', 'MIXED', ['RPG', 'Adventure'], ['Single player', 'Multiplayer'], '탐험과 빌드 성장은 매력적이다', '강한 처벌과 긴장감이 휴식용 플레이와 충돌한다', ['OPEN_WORLD_RPG', 'HIGH_DIFFICULTY', 'BUILD_CRAFTING']),
      e('Factorio', 'factorio', 'MIXED', ['Simulator', 'Strategy'], ['Single player', 'Multiplayer'], '공장 자동화가 지적인 만족을 준다', '최적화 압박이 강해지면 생활형 감각보다 계산 피로가 커진다', ['AUTOMATION', 'SYSTEMS', 'OPTIMIZATION']),
      e('Final Fantasy XIV', 'final-fantasy-xiv', 'MIXED', ['RPG'], ['MMO', 'Multiplayer'], '메인 시나리오와 직업 성장은 매우 좋다', '파티 매칭과 숙제 루틴은 솔로 성향과 가끔 부딪힌다', ['MMORPG', 'STORY_RICH', 'CLASS_PROGRESSION']),
      e('Animal Crossing: New Horizons', 'animal-crossing-new-horizons', 'MIXED', ['Simulator'], ['Single player', 'Multiplayer'], '섬 꾸미기와 수집은 편안하다', '실시간 제한 때문에 원하는 만큼 몰아서 하기 어렵다', ['LIFE_SIM', 'DECORATION', 'COLLECTION']),
      e('League of Legends', 'league-of-legends', 'DISLIKE', ['MOBA', 'Strategy'], ['Multiplayer'], '챔피언 성장과 역할 분담은 분명하다', '팀 의존도와 랭크 스트레스가 너무 강하다', ['MOBA', 'RANKED', 'TEAM_DEPENDENCY']),
      e('Valorant', 'valorant', 'DISLIKE', ['Shooter', 'Tactical'], ['Multiplayer'], '전술성과 에이전트 개성은 보인다', '정밀 조준과 음성 협업 압박이 휴식 플레이와 맞지 않는다', ['TACTICAL_SHOOTER', 'PVP', 'HIGH_PRESSURE']),
      e('Apex Legends', 'apex-legends', 'DISLIKE', ['Shooter'], ['Multiplayer'], '이동과 교전 속도는 인상적이다', '짧고 강한 경쟁 루프가 너무 소모적이다', ['BATTLE_ROYALE', 'HIGH_APM', 'PVP']),
      e('Counter-Strike 2', 'counter-strike-2', 'DISLIKE', ['Shooter'], ['Multiplayer'], '라운드 전술과 실력 곡선은 명확하다', '실수 한 번의 부담이 커서 느긋한 몰입이 어렵다', ['TACTICAL_SHOOTER', 'RANKED', 'PRECISION']),
      e('Rocket League', 'rocket-league', 'DISLIKE', ['Sport', 'Racing'], ['Multiplayer'], '짧은 경기와 물리 조작은 독특하다', '순간 반응과 팀플 압박이 원하는 장르 감성과 다르다', ['COMPETITIVE', 'SHORT_MATCH', 'SKILL_CEILING']),
      e('Call of Duty: Modern Warfare III', 'call-of-duty-modern-warfare-iii', 'DISLIKE', ['Shooter'], ['Single player', 'Multiplayer'], '총기 피드백은 시원하다', '빠른 교전과 반복 매치가 캐릭터 성장 욕구를 채우지 못한다', ['FPS', 'FAST_PACE', 'MATCH_BASED']),
      e('EA Sports FC 24', 'ea-sports-fc-24', 'DISLIKE', ['Sport'], ['Single player', 'Multiplayer'], '팀 구성과 경기 연출은 깔끔하다', '스포츠 경쟁 구조가 RPG나 시뮬레이션 취향과 거리가 멀다', ['SPORTS', 'COMPETITIVE', 'SEASONAL']),
      e('Mortal Kombat 1', 'mortal-kombat-1', 'DISLIKE', ['Fighting'], ['Single player', 'Multiplayer'], '연출과 캐릭터 개성은 강하다', '콤보 암기와 대전 압박이 솔로 성장형 플레이와 맞지 않는다', ['FIGHTING', 'PVP', 'COMBO_EXECUTION']),
    ],
  },
  {
    id: 'puzzle_solo',
    name: '퍼즐 솔로 선호 플레이어',
    expectedCount: 80,
    dominantKeywords: [
      'PUZZLE',
      'SOLO_PLAY',
      'LOGIC',
      'DEDUCTION',
      'SPATIAL_REASONING',
      'EUREKA',
    ],
    positiveFrame:
      '규칙을 관찰하고 혼자 해법을 발견하는',
    journalFrame:
      '힌트를 적게 받고 천천히 구조를 해석하는',
    avoidanceKeywords: [
      'GRIND',
      'RANDOM_LOOT',
      'PVP_PRESSURE',
      'REFLEX_HEAVY',
      'BUSYWORK',
    ],
    games: [
      e('Portal', 'portal', 'LIKE', ['Puzzle', 'Platform'], ['Single player'], '포털 규칙이 짧은 방마다 선명하게 확장된다', '액션 타이밍이 아주 가끔 요구된다', ['SPATIAL_REASONING', 'EUREKA', 'FIRST_PERSON_PUZZLE']),
      e('Portal 2', 'portal-2', 'LIKE', ['Puzzle', 'Platform'], ['Single player', 'Co-op'], '젤과 빛다리 같은 장치가 단계적으로 쌓인다', '협동 모드는 상대 일정에 영향을 받는다', ['SPATIAL_REASONING', 'COMEDY', 'SYSTEMIC_RULES']),
      e('The Witness', 'the-witness', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '섬 전체가 규칙 학습장처럼 연결된다', '막히면 힌트 없이 오래 서성일 수 있다', ['OBSERVATION', 'LINE_PUZZLE', 'OPEN_WORLD_PUZZLE']),
      e('Baba Is You', 'baba-is-you', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '문장을 바꾸면 세계 규칙이 바뀌는 발상이 강력하다', '후반 난도는 머리를 오래 붙잡는다', ['RULE_MANIPULATION', 'LOGIC', 'EUREKA']),
      e('Return of the Obra Dinn', 'return-of-the-obra-dinn', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '사망 장면과 단서 연결이 추리 노트처럼 작동한다', '이름을 맞히는 과정이 막힐 때 답답하다', ['DEDUCTION', 'MYSTERY', 'OBSERVATION']),
      e('Outer Wilds', 'outer-wilds', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '지식 자체가 진행도가 되는 구조가 아름답다', '시간 루프 압박이 초반에는 불안하다', ['KNOWLEDGE_GATE', 'EXPLORATION', 'MYSTERY']),
      e('Fez', 'fez', 'LIKE', ['Puzzle', 'Platform'], ['Single player'], '시점을 돌리는 순간 공간 해석이 바뀐다', '숨은 암호는 외부 메모가 필요하다', ['PERSPECTIVE_SHIFT', 'SECRET_HUNT', 'PIXEL_ART']),
      e('Braid', 'braid', 'LIKE', ['Puzzle', 'Platform'], ['Single player'], '시간 조작을 퍼즐 문법으로 끝까지 밀어붙인다', '정밀 점프가 섞이면 흐름이 끊긴다', ['TIME_MANIPULATION', 'PLATFORM_PUZZLE', 'EUREKA']),
      e('The Talos Principle', 'the-talos-principle', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '레이저와 장치 조합이 차분한 사고 실험처럼 느껴진다', '철학 텍스트가 길게 느껴질 때가 있다', ['LOGIC', 'PHILOSOPHY', 'FIRST_PERSON_PUZZLE']),
      e('The Talos Principle 2', 'the-talos-principle-2', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '새 장치가 기존 규칙을 크게 무너뜨리지 않고 확장한다', '거대한 허브 이동은 취향을 탄다', ['LOGIC', 'WORLD_BUILDING', 'SYSTEMIC_RULES']),
      e('The Case of the Golden Idol', 'the-case-of-the-golden-idol', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '단어 조각을 맞춰 사건의 인과관계를 세우는 맛이 좋다', '한 단어 차이로 오래 막힐 수 있다', ['DEDUCTION', 'WORD_PUZZLE', 'MYSTERY']),
      e('Strange Horticulture', 'strange-horticulture', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '식물 도감과 지도 단서를 조합하는 속도가 좋다', '반복 손님 응대가 살짝 단조롭다', ['DEDUCTION', 'CATALOGING', 'ATMOSPHERE']),
      e('Unpacking', 'unpacking', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '물건 배치만으로 인물의 삶을 읽게 한다', '전통적인 난도 상승은 약하다', ['SPATIAL_ORGANIZATION', 'ENVIRONMENTAL_STORY', 'COZY']),
      e('Gorogoa', 'gorogoa', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '그림 패널을 겹치고 이동하는 방식이 직관적이다', '분량이 짧아 더 하고 싶어진다', ['VISUAL_PUZZLE', 'PATTERN_MATCHING', 'ARTFUL']),
      e('Monument Valley', 'monument-valley', 'LIKE', ['Puzzle'], ['Single player'], '불가능한 건축물을 돌리는 감각이 간결하다', '모바일식 짧은 분량이 아쉽다', ['OPTICAL_ILLUSION', 'SPATIAL_REASONING', 'MINIMALIST']),
      e('Monument Valley 2', 'monument-valley-2', 'LIKE', ['Puzzle'], ['Single player'], '부모와 아이의 이동이 퍼즐과 감정선을 함께 만든다', '난도가 낮아 깊은 고민은 적다', ['OPTICAL_ILLUSION', 'EMOTIONAL', 'ACCESSIBLE']),
      e('Opus Magnum', 'opus-magnum', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '기계 팔을 배치해 더 효율적인 해법을 다듬는 재미가 크다', '최적화 욕심이 강해지면 시간이 녹는다', ['OPTIMIZATION', 'PROGRAMMING_PUZZLE', 'ENGINEERING']),
      e('Hexcells', 'hexcells', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '숫자 단서만으로 안전하게 추론하는 맛이 깔끔하다', '연출적 보상은 적다', ['LOGIC', 'MINESWEEPER_LIKE', 'CALM_FOCUS']),
      e('Stephen\'s Sausage Roll', 'stephens-sausage-roll', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '단순한 소시지 굴리기가 무서운 깊이로 확장된다', '난도가 높아 한 판에 오래 갇힌다', ['SOKOBAN', 'HARD_PUZZLE', 'SPATIAL_REASONING']),
      e('Patrick\'s Parabox', 'patricks-parabox', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '상자 안의 상자라는 재귀 규칙이 명확하게 배운다', '후반에는 머릿속 시뮬레이션이 필요하다', ['RECURSION', 'SOKOBAN', 'LOGIC']),
      e('A Monster\'s Expedition', 'a-monsters-expedition', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '나무를 밀어 섬을 잇는 규칙이 부드럽게 변주된다', '길을 잃으면 이전 섬을 다시 봐야 한다', ['SOKOBAN', 'OPEN_WORLD_PUZZLE', 'RELAXED']),
      e('Bonfire Peaks', 'bonfire-peaks', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '상자를 태우는 목표가 공간 퍼즐과 잘 맞는다', '한 스테이지가 막히면 진행감이 멈춘다', ['SOKOBAN', 'VOXEL', 'HARD_PUZZLE']),
      e('Cocoon', 'cocoon', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '세계 구슬을 들고 들어가는 구조가 매끄럽다', '설명이 거의 없어 초반 해석이 필요하다', ['WORLD_WITHIN_WORLD', 'ATMOSPHERIC', 'SYSTEMIC_RULES']),
      e('Viewfinder', 'viewfinder', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '사진이 실제 공간으로 변하는 순간이 계속 신선하다', '일부 구간은 정답 각도를 찾는 느낌이 강하다', ['PERSPECTIVE_SHIFT', 'FIRST_PERSON_PUZZLE', 'CREATIVE']),
      e('Superliminal', 'superliminal', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '크기와 시점 착시를 이용한 해법이 재치 있다', '서사 톤은 취향보다 가볍다', ['PERSPECTIVE_SHIFT', 'OPTICAL_ILLUSION', 'FIRST_PERSON_PUZZLE']),
      e('Antichamber', 'antichamber', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '공간이 예상과 다르게 접히는 규칙을 관찰하게 한다', '길 찾기가 의도적으로 혼란스럽다', ['NON_EUCLIDEAN', 'OBSERVATION', 'EXPERIMENTAL']),
      e('Manifold Garden', 'manifold-garden', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '중력과 무한 반복 공간이 압도적인 퍼즐 풍경을 만든다', '시각 정보가 많아 어지러울 수 있다', ['GRAVITY', 'NON_EUCLIDEAN', 'SPATIAL_REASONING']),
      e('Toki Tori 2+', 'toki-tori-2-plus', 'LIKE', ['Puzzle', 'Platform'], ['Single player'], '아주 적은 행동으로 생태계 규칙을 풀게 한다', '초반 목표 안내가 일부러 희미하다', ['OPEN_WORLD_PUZZLE', 'ANIMAL_RULES', 'METROIDBRAINIA']),
      e('World of Goo', 'world-of-goo', 'LIKE', ['Puzzle', 'Strategy'], ['Single player'], '구조물 물리와 자원 제한이 직관적인 실험을 만든다', '정밀하게 쌓는 구간은 손이 바쁘다', ['PHYSICS_PUZZLE', 'CONSTRUCTION', 'EXPERIMENTAL']),
      e('Mini Metro', 'mini-metro', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '노선 하나가 도시 흐름을 바꾸는 압축감이 좋다', '후반 혼잡이 빠르게 올라와 긴장된다', ['SYSTEM_OPTIMIZATION', 'MINIMALIST', 'TRANSPORT']),
      e('Mini Motorways', 'mini-motorways', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '도로 배치와 병목 해소가 매 판 다른 사고를 요구한다', '시간 압박이 높아지면 휴식감은 줄어든다', ['SYSTEM_OPTIMIZATION', 'TRAFFIC', 'MINIMALIST']),
      e('Dorfromantik', 'dorfromantik', 'LIKE', ['Puzzle', 'Strategy'], ['Single player'], '타일 배치가 점수와 풍경 감상을 동시에 준다', '장기 목표가 느슨해 집중이 풀릴 때가 있다', ['TILE_PLACEMENT', 'COZY', 'SPATIAL_PLANNING']),
      e('Islanders', 'islanders', 'LIKE', ['Puzzle', 'Strategy'], ['Single player'], '작은 섬에 건물을 배치하는 점수 규칙이 명료하다', '실패하면 섬을 떠나는 구조가 살짝 건조하다', ['CITY_PUZZLE', 'MINIMALIST', 'PLACEMENT']),
      e('Carto', 'carto', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '지도를 조각내 다시 붙이는 발상이 탐험과 잘 맞는다', '난도가 부드러워 깊은 추리는 적다', ['MAP_PUZZLE', 'ADVENTURE', 'COZY']),
      e('Chants of Sennaar', 'chants-of-sennaar', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '언어를 관찰하고 단어 의미를 추론하는 과정이 탁월하다', '잠입 구간은 퍼즐 흐름과 살짝 다르다', ['LANGUAGE_DEDUCTION', 'OBSERVATION', 'MYSTERY']),
      e('Heaven\'s Vault', 'heavens-vault', 'LIKE', ['Adventure', 'Puzzle'], ['Single player'], '고대 문자를 해석하는 과정이 느린 추리처럼 쌓인다', '이동 템포가 느려 답답할 때가 있다', ['LANGUAGE_DEDUCTION', 'NARRATIVE', 'ARCHAEOLOGY']),
      e('The Room', 'the-room', 'LIKE', ['Puzzle'], ['Single player'], '장치 상자를 만지며 비밀을 여는 손맛이 좋다', '분량이 짧고 공간이 제한적이다', ['ESCAPE_ROOM', 'TACTILE', 'MECHANICAL']),
      e('The Room Two', 'the-room-two', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '여러 장치를 넘나드는 진행이 더 넓어졌다', '숨은 조작 포인트를 놓치면 막힌다', ['ESCAPE_ROOM', 'MECHANICAL', 'ATMOSPHERIC']),
      e('The Room Three', 'the-room-three', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '분기와 장치 밀도가 높아져 탐색감이 좋다', '일부 퍼즐은 클릭 지점 찾기에 가깝다', ['ESCAPE_ROOM', 'MECHANICAL', 'MYSTERY']),
      e('The Room 4: Old Sins', 'the-room-4-old-sins', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '인형집 구조가 작은 공간 퍼즐을 유기적으로 연결한다', '비슷한 장치 문법이 반복된다', ['ESCAPE_ROOM', 'DOLLHOUSE', 'TACTILE']),
      e('Q.U.B.E. 2', 'qube-2', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '색 블록 규칙이 일인칭 공간 퍼즐로 잘 정리된다', '서사는 퍼즐보다 약하다', ['FIRST_PERSON_PUZZLE', 'COLOR_RULES', 'SPATIAL_REASONING']),
      e('The Swapper', 'the-swapper', 'LIKE', ['Puzzle', 'Platform'], ['Single player'], '복제와 의식 이동 규칙이 퍼즐과 주제를 함께 만든다', '조작 타이밍이 필요한 방은 살짝 부담스럽다', ['CLONE_PUZZLE', 'SCI_FI', 'ATMOSPHERIC']),
      e('Human Resource Machine', 'human-resource-machine', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '명령어를 조합해 문제를 해결하는 맛이 명확하다', '프로그래밍식 사고가 안 맞으면 막힐 수 있다', ['PROGRAMMING_PUZZLE', 'LOGIC', 'OPTIMIZATION']),
      e('7 Billion Humans', '7-billion-humans', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '병렬 명령을 설계하는 퍼즐이 더 복잡하고 흥미롭다', '디버깅 시간이 길어질 수 있다', ['PROGRAMMING_PUZZLE', 'PARALLEL_LOGIC', 'OPTIMIZATION']),
      e('Infinifactory', 'infinifactory', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '공장 라인을 설계하고 줄이는 과정이 강한 성취감을 준다', '3D 배치가 복잡해 후반 피로가 있다', ['ENGINEERING', 'OPTIMIZATION', 'SPATIAL_REASONING']),
      e('SpaceChem', 'spacechem', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '분자 생산 라인을 설계하는 논리성이 깊다', '튜토리얼 이후 난도가 급하게 오른다', ['PROGRAMMING_PUZZLE', 'OPTIMIZATION', 'CHEMISTRY']),
      e('Snakebird', 'snakebird', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '움직임 하나하나가 공간 추론을 강하게 요구한다', '귀여운 외형보다 훨씬 어렵다', ['HARD_PUZZLE', 'SPATIAL_REASONING', 'SOKOBAN']),
      e('Linelight', 'linelight', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '선 위를 따라가는 규칙이 음악처럼 변주된다', '큰 서사나 보상 구조는 거의 없다', ['MINIMALIST', 'TIMING_PUZZLE', 'CALM_FOCUS']),
      e('Maquette', 'maquette', 'LIKE', ['Puzzle', 'Adventure'], ['Single player'], '작은 세계와 큰 세계가 맞물리는 구조가 인상적이다', '물체 조작이 가끔 답답하다', ['RECURSIVE_WORLD', 'PERSPECTIVE', 'NARRATIVE']),
      e('The Pedestrian', 'the-pedestrian', 'LIKE', ['Puzzle', 'Platform'], ['Single player'], '표지판을 잇는 방식이 깔끔한 공간 연결 퍼즐이다', '액션 요소가 강해지는 구간은 취향을 탄다', ['SIGN_PUZZLE', 'SPATIAL_CONNECTION', 'PLATFORM_PUZZLE']),
      e('GNOG', 'gnog', 'LIKE', ['Puzzle', 'Indie'], ['Single player'], '장난감 머리를 돌리고 만지는 실험성이 즐겁다', '논리 퍼즐보다 감각 놀이에 가깝다', ['TACTILE', 'VISUAL_PUZZLE', 'PLAYFUL']),
      e('Little Inferno', 'little-inferno', 'LIKE', ['Puzzle', 'Simulator'], ['Single player'], '물건 조합과 블랙 코미디가 묘한 추론 욕구를 만든다', '직접적인 퍼즐 밀도는 낮다', ['COMBINATION', 'DARK_HUMOR', 'EXPERIMENTAL']),
      e('Tunic', 'tunic', 'MIXED', ['Adventure', 'Puzzle'], ['Single player'], '설명서 해독과 숨은 규칙 발견은 훌륭하다', '전투 난도와 반응 조작이 순수 퍼즐 집중을 방해한다', ['SECRET_LANGUAGE', 'METROIDBRAINIA', 'ACTION_ADVENTURE']),
      e('Animal Well', 'animal-well', 'MIXED', ['Puzzle', 'Platform'], ['Single player'], '도구 조합과 비밀 발견이 깊다', '플랫폼 조작과 어두운 탐색이 피곤한 날에는 버겁다', ['SECRET_HUNT', 'METROIDBRAINIA', 'PLATFORM_PUZZLE']),
      e('Lorelei and the Laser Eyes', 'lorelei-and-the-laser-eyes', 'MIXED', ['Puzzle', 'Adventure'], ['Single player'], '상징과 숫자 퍼즐의 밀도가 매우 좋다', '불친절한 구조 때문에 노트 정리가 필수다', ['DEDUCTION', 'SYMBOLS', 'MYSTERY']),
      e('Myst', 'myst', 'MIXED', ['Puzzle', 'Adventure'], ['Single player'], '섬의 장치 논리를 관찰하는 고전적 맛이 있다', '현대 퍼즐에 비해 이동과 단서 연결이 느리다', ['CLASSIC_PUZZLE', 'OBSERVATION', 'ADVENTURE']),
      e('Riven', 'riven', 'MIXED', ['Puzzle', 'Adventure'], ['Single player'], '세계 자체를 해석해야 하는 설계가 깊다', '단서 밀도가 높아 짧은 세션에는 부담스럽다', ['CLASSIC_PUZZLE', 'WORLD_LOGIC', 'OBSERVATION']),
      e('Obduction', 'obduction', 'MIXED', ['Puzzle', 'Adventure'], ['Single player'], '낯선 공간의 기계 규칙을 읽는 재미가 있다', '이동 동선이 길어 사고 흐름이 끊긴다', ['FIRST_PERSON_PUZZLE', 'SCI_FI', 'WORLD_LOGIC']),
      e('The Forgotten City', 'the-forgotten-city', 'MIXED', ['Adventure', 'RPG'], ['Single player'], '시간 루프 추리와 대화 선택은 흥미롭다', '퍼즐보다 대화와 탐문 비중이 커서 장르 기대와 다르다', ['TIME_LOOP', 'DEDUCTION', 'NARRATIVE']),
      e('Her Story', 'her-story', 'MIXED', ['Puzzle', 'Simulator'], ['Single player'], '검색어를 떠올려 사건을 복원하는 방식이 독특하다', '영상 단서를 보는 시간이 길어 수동 퍼즐감은 약하다', ['FMV', 'DEDUCTION', 'SEARCH']),
      e('Telling Lies', 'telling-lies', 'MIXED', ['Adventure', 'Simulator'], ['Single player'], '대화 조각을 검색해 인물 관계를 재구성하는 재미가 있다', '퍼즐 해법보다 서사 감상이 중심이다', ['FMV', 'NARRATIVE', 'SEARCH']),
      e('Immortality', 'immortality', 'MIXED', ['Puzzle', 'Adventure'], ['Single player'], '이미지 매칭으로 장면을 넘나드는 구조가 매혹적이다', '해석 중심이라 명확한 정답 퍼즐을 기대하면 흔들린다', ['FMV', 'IMAGE_MATCHING', 'MYSTERY']),
      e('Disco Elysium', 'disco-elysium', 'MIXED', ['RPG', 'Adventure'], ['Single player'], '대화 추리와 선택지는 깊다', '논리 퍼즐보다 텍스트 RPG라 피로도가 다르다', ['NARRATIVE', 'DETECTIVE', 'RPG']),
      e('Civilization VI', 'sid-meiers-civilization-vi', 'MIXED', ['Strategy'], ['Single player', 'Multiplayer'], '장기 계획과 타일 판단은 퍼즐처럼 재미있다', '한 판이 너무 길어 순수 퍼즐 세션으로는 무겁다', ['STRATEGY', 'SYSTEMS', 'LONG_SESSION']),
      e('Into the Breach', 'into-the-breach', 'MIXED', ['Strategy', 'Puzzle'], ['Single player'], '적 의도를 보고 최적 수를 찾는 퍼즐성이 강하다', '전투 손실과 캠페인 압박은 차분한 퍼즐과 다르다', ['TACTICAL_PUZZLE', 'TURN_BASED', 'PERFECT_INFORMATION']),
      e('Slay the Spire', 'slay-the-spire', 'MIXED', ['Strategy', 'Card & Board Game'], ['Single player'], '카드 조합을 계산하는 맛이 있다', '확률과 빌드 운이 개입해 순수 논리 퍼즐과 차이가 있다', ['DECKBUILDING', 'STRATEGY', 'ROGUELIKE']),
      e('Escape Simulator', 'escape-simulator', 'LIKE', ['Puzzle', 'Simulator'], ['Single player', 'Co-op'], '방 안의 사물과 단서를 조합해 탈출 루트를 찾는 흐름이 좋다', '협동 방에서는 상대 속도에 맞춰야 한다', ['ESCAPE_ROOM', 'OBJECT_INSPECTION', 'COOP_OPTIONAL']),
      e('Call of Duty: Modern Warfare III', 'call-of-duty-modern-warfare-iii', 'DISLIKE', ['Shooter'], ['Single player', 'Multiplayer'], '총격 연출은 강렬하다', '반사 신경 중심이라 규칙을 천천히 해석할 시간이 부족하다', ['FPS', 'REFLEX_HEAVY', 'FAST_PACE']),
      e('EA Sports FC 24', 'ea-sports-fc-24', 'DISLIKE', ['Sport'], ['Single player', 'Multiplayer'], '축구 팬에게는 시즌 감각이 있다', '스포츠 경기 반복은 추리와 공간 퍼즐 취향을 거의 건드리지 못한다', ['SPORTS', 'COMPETITIVE', 'SEASONAL']),
      e('Diablo IV', 'diablo-iv', 'DISLIKE', ['RPG'], ['Single player', 'Multiplayer'], '전투와 파밍 피드백은 즉각적이다', '랜덤 장비 파밍이 논리 해법보다 반복 보상에 기대고 있다', ['LOOT', 'GRIND', 'ACTION_RPG']),
      e('Path of Exile', 'path-of-exile', 'DISLIKE', ['RPG'], ['Multiplayer'], '빌드 트리는 복잡하고 분석할 거리가 많다', '파밍과 경제 지식 부담이 퍼즐의 깔끔함과 다르다', ['LOOT', 'BUILD_COMPLEXITY', 'GRIND']),
      e('Monster Hunter: World', 'monster-hunter-world', 'DISLIKE', ['RPG', 'Adventure'], ['Single player', 'Co-op'], '몬스터 패턴 학습은 퍼즐적으로 볼 수 있다', '장비 파밍과 액션 숙련이 더 큰 비중이라 오래 맞지 않았다', ['ACTION_RPG', 'GRIND', 'BOSS_HUNT']),
      e('Apex Legends', 'apex-legends', 'DISLIKE', ['Shooter'], ['Multiplayer'], '팀 전술과 위치 판단은 존재한다', '빠른 교전과 에임 압박이 사고 시간을 줄인다', ['BATTLE_ROYALE', 'PVP_PRESSURE', 'REFLEX_HEAVY']),
      e('Fortnite', 'fortnite', 'DISLIKE', ['Shooter'], ['Multiplayer'], '건설과 전투의 조합은 독특하다', '시즌 콘텐츠와 전투 속도가 차분한 솔로 퍼즐과 맞지 않는다', ['BATTLE_ROYALE', 'SEASONAL', 'FAST_PACE']),
      e('Grand Theft Auto V', 'grand-theft-auto-v', 'DISLIKE', ['Adventure', 'Shooter'], ['Single player', 'Multiplayer'], '도시 규모와 자유도는 크다', '명확한 규칙 퍼즐보다 액션과 상황극이 중심이라 선호도가 낮다', ['OPEN_WORLD', 'ACTION', 'SANDBOX']),
      e('Red Dead Redemption 2', 'red-dead-redemption-2', 'DISLIKE', ['Adventure'], ['Single player', 'Multiplayer'], '세계 묘사는 훌륭하다', '느린 이동과 서사 몰입이 퍼즐 해법의 쾌감과는 다르게 다가왔다', ['OPEN_WORLD', 'NARRATIVE', 'SLOW_PACE']),
      e('Tekken 8', 'tekken-8', 'DISLIKE', ['Fighting'], ['Single player', 'Multiplayer'], '프레임 지식과 심리전은 분석할 수 있다', '입력 숙련과 대전 압박이 혼자 푸는 퍼즐 취향과 충돌한다', ['FIGHTING', 'COMBO_EXECUTION', 'PVP_PRESSURE']),
      e('Forza Horizon 5', 'forza-horizon-5', 'DISLIKE', ['Racing'], ['Single player', 'Multiplayer'], '주행감과 풍경은 시원하다', '속도와 차량 수집이 논리 추론 취향을 충분히 채우지 못한다', ['RACING', 'COLLECTION', 'FAST_PACE']),
      e('Doom Eternal', 'doom-eternal', 'DISLIKE', ['Shooter'], ['Single player'], '전투 리듬은 정교하다', '항상 움직이고 쏘는 압박이 조용한 사고 시간을 빼앗는다', ['FPS', 'HIGH_APM', 'ACTION']),
      e('Hades', 'hades', 'DISLIKE', ['RPG', 'Hack and slash/Beat em up'], ['Single player'], '무기와 신 은혜 조합은 매력적이다', '반복 전투와 반응 조작이 퍼즐 중심 만족과 거리가 있다', ['ROGUELIKE', 'ACTION', 'BUILD_CRAFTING']),
    ],
  },
  {
    id: 'multiplayer_social',
    name: '멀티플레이 선호 플레이어',
    expectedCount: 20,
    dominantKeywords: [
      'MULTIPLAYER',
      'COOP',
      'PVP',
      'TEAMPLAY',
      'VOICE_COMMS',
      'META_MASTERY',
    ],
    positiveFrame:
      '사람과 부딪히며 매 판 다른 변수를 만드는',
    journalFrame:
      '팀 콜, 역할 분담, 실시간 판단이 결과로 이어지는',
    avoidanceKeywords: [
      'SINGLE_PLAYER_ONLY',
      'LOW_SOCIAL_LOOP',
      'SLOW_NARRATIVE',
      'NO_REPLAY_PRESSURE',
    ],
    games: [
      e('Valorant', 'valorant', 'LIKE', ['Shooter', 'Tactical'], ['Multiplayer'], '에이전트 조합과 라운드 콜이 승패를 크게 바꾼다', '팀 분위기에 따라 피로도가 달라진다', ['TACTICAL_SHOOTER', 'TEAMPLAY', 'RANKED']),
      e('Counter-Strike 2', 'counter-strike-2', 'LIKE', ['Shooter'], ['Multiplayer'], '경제 관리와 투척물 약속이 팀 실력으로 드러난다', '실수 책임이 큰 편이다', ['TACTICAL_SHOOTER', 'PRECISION', 'TEAMPLAY']),
      e('League of Legends', 'league-of-legends', 'LIKE', ['MOBA', 'Strategy'], ['Multiplayer'], '라인전과 오브젝트 판단이 팀 흐름을 만든다', '채팅 분위기가 나쁘면 즐거움이 줄어든다', ['MOBA', 'META_MASTERY', 'TEAMPLAY']),
      e('Dota 2', 'dota-2', 'LIKE', ['MOBA', 'Strategy'], ['Multiplayer'], '영웅 조합과 아이템 선택이 매 판 다르게 작동한다', '러닝 커브가 매우 가파르다', ['MOBA', 'DEEP_META', 'TEAM_STRATEGY']),
      e('Overwatch 2', 'overwatch-2', 'LIKE', ['Shooter'], ['Multiplayer'], '역할 전환과 궁극기 연계가 팀 하이라이트를 만든다', '밸런스 변화에 적응해야 한다', ['HERO_SHOOTER', 'TEAMFIGHT', 'ROLE_QUEUE']),
      e('Apex Legends', 'apex-legends', 'LIKE', ['Shooter'], ['Multiplayer'], '이동, 핑, 교전 판단이 스쿼드 호흡으로 이어진다', '초반 탈락하면 세션 감정이 흔들린다', ['BATTLE_ROYALE', 'SQUAD', 'MOVEMENT']),
      e('Fortnite', 'fortnite', 'LIKE', ['Shooter'], ['Multiplayer'], '친구와 시즌 퀘스트를 밀며 가볍게 복귀하기 좋다', '콘텐츠 변화가 너무 빠르게 느껴질 때가 있다', ['BATTLE_ROYALE', 'SOCIAL_PLAY', 'SEASONAL']),
      e('PUBG: Battlegrounds', 'pubg-battlegrounds', 'LIKE', ['Shooter'], ['Multiplayer'], '긴장감 있는 파밍과 포지션 콜이 스쿼드 플레이를 살린다', '대기와 이동 시간이 길 수 있다', ['BATTLE_ROYALE', 'TACTICAL', 'SQUAD']),
      e('Rocket League', 'rocket-league', 'LIKE', ['Sport', 'Racing'], ['Multiplayer'], '짧은 경기마다 팀 합과 개인 기술을 바로 확인한다', '연패하면 손에 힘이 많이 들어간다', ['COMPETITIVE', 'SHORT_MATCH', 'SKILL_CEILING']),
      e('Tom Clancy\'s Rainbow Six Siege', 'tom-clancys-rainbow-six-siege', 'LIKE', ['Shooter', 'Tactical'], ['Multiplayer'], '정보전과 진입 타이밍이 팀 전략을 강하게 만든다', '맵 지식 요구가 높다', ['TACTICAL_SHOOTER', 'TEAM_STRATEGY', 'INFORMATION']),
      e('Helldivers 2', 'helldivers-2', 'LIKE', ['Shooter'], ['Co-op', 'Multiplayer'], '아군 오폭까지 웃음으로 바뀌는 협동 긴장감이 좋다', '난도가 오르면 장비 조합 책임이 커진다', ['COOP', 'PVE', 'CHAOTIC_TEAMPLAY']),
      e('Monster Hunter: World', 'monster-hunter-world', 'LIKE', ['RPG', 'Adventure'], ['Single player', 'Co-op'], '파티가 역할을 나눠 대형 몬스터를 쓰러뜨리는 순간이 좋다', '준비 시간이 길 때가 있다', ['COOP', 'BOSS_HUNT', 'GEAR_PROGRESSION']),
      e('Final Fantasy XIV', 'final-fantasy-xiv', 'LIKE', ['RPG'], ['MMO', 'Multiplayer'], '레이드 콜과 직업 역할이 커뮤니티 플레이로 이어진다', '일정 맞추기는 부담이 된다', ['MMORPG', 'RAID', 'SOCIAL_PLAY']),
      e('Dead by Daylight', 'dead-by-daylight', 'LIKE', ['Horror', 'Strategy'], ['Multiplayer'], '생존자와 살인마의 심리전이 매 판 다르게 터진다', '매칭 밸런스에 기분이 좌우된다', ['ASYMMETRIC_MULTIPLAYER', 'HORROR', 'MINDGAME']),
      e('Sea of Thieves', 'sea-of-thieves', 'LIKE', ['Adventure'], ['Multiplayer'], '선원 역할과 즉흥 사건이 친구들과 이야기거리를 만든다', '목표 없이 떠돌면 늘어진다', ['COOP', 'SANDBOX', 'SOCIAL_ADVENTURE']),
      e('Minecraft', 'minecraft', 'LIKE', ['Simulator', 'Adventure'], ['Single player', 'Multiplayer'], '서버에서 건축과 탐험을 나누면 오래 가는 공동 목표가 생긴다', '혼자 하면 동기가 빠르게 줄어든다', ['SANDBOX', 'COOP_BUILDING', 'CREATIVE']),
      e('The Witness', 'the-witness', 'DISLIKE', ['Puzzle', 'Adventure'], ['Single player'], '퍼즐 설계는 정교하다', '혼자 조용히 고민하는 구조라 팀 콜의 재미가 없다', ['SINGLE_PLAYER_ONLY', 'PUZZLE', 'LOW_SOCIAL_LOOP']),
      e('Firewatch', 'firewatch', 'DISLIKE', ['Adventure'], ['Single player'], '대화와 분위기는 좋다', '한 번 보고 끝나는 서사형 경험이라 반복 멀티 동기가 약하다', ['WALKING_SIM', 'NARRATIVE', 'LOW_REPLAYABILITY']),
      e('Disco Elysium', 'disco-elysium', 'DISLIKE', ['RPG', 'Adventure'], ['Single player'], '텍스트와 선택지는 뛰어나다', '느린 독서형 진행은 같이 떠들며 하는 취향과 맞지 않는다', ['SINGLE_PLAYER_ONLY', 'TEXT_HEAVY', 'SLOW_NARRATIVE']),
      e('Euro Truck Simulator 2', 'euro-truck-simulator-2', 'MIXED', ['Simulator', 'Indie'], ['Single player', 'Multiplayer'], '컨보이로 달릴 때는 느긋한 멀티가 된다', '솔로 배송만 하면 긴장과 경쟁이 부족하다', ['DRIVING_SIM', 'RELAXED_MULTIPLAYER', 'LOW_PRESSURE']),
    ],
  },
  {
    id: 'horror_atmosphere',
    name: '공포 게임 선호 플레이어',
    expectedCount: 20,
    dominantKeywords: [
      'HORROR',
      'ATMOSPHERE',
      'SURVIVAL',
      'DREAD',
      'SOUND_DESIGN',
      'LIMITED_RESOURCES',
    ],
    positiveFrame:
      '불안한 분위기와 제한된 자원 속에서 버티는',
    journalFrame:
      '소리, 어둠, 추격, 심리적 압박이 기억에 남는',
    avoidanceKeywords: [
      'LOW_TENSION',
      'COZY_LOOP',
      'BRIGHT_TONE',
      'SPORTS_SIM',
    ],
    games: [
      e('Resident Evil 7: Biohazard', 'resident-evil-7-biohazard', 'LIKE', ['Horror', 'Shooter'], ['Single player'], '좁은 집과 가족의 위협이 계속 신경을 곤두세운다', '전투 구간은 공포보다 액션으로 느껴질 때가 있다', ['SURVIVAL_HORROR', 'FIRST_PERSON', 'DREAD']),
      e('Resident Evil Village', 'resident-evil-village', 'LIKE', ['Horror', 'Shooter'], ['Single player'], '마을과 성의 분위기가 강하고 탐색 보상이 좋다', '후반은 액션 비중이 커진다', ['SURVIVAL_HORROR', 'GOTHIC', 'EXPLORATION']),
      e('Silent Hill 2', 'silent-hill-2', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '심리적 상징과 안개 낀 공간이 오래 남는다', '전투 조작은 오래된 느낌이 있다', ['PSYCHOLOGICAL_HORROR', 'ATMOSPHERE', 'SYMBOLISM']),
      e('Amnesia: The Dark Descent', 'amnesia-the-dark-descent', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '무력감과 어둠 관리가 공포를 직접 만든다', '숨는 시간이 길어 답답할 수 있다', ['HIDE_AND_SEEK', 'SANITY', 'DREAD']),
      e('SOMA', 'soma', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '존재론적 질문과 해저 시설의 고립감이 강하다', '괴물 회피보다 서사가 더 무서울 때가 많다', ['SCI_FI_HORROR', 'PHILOSOPHY', 'ATMOSPHERE']),
      e('Outlast', 'outlast', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '카메라 야간시야와 도주 중심 구조가 긴장을 유지한다', '반복 추격은 피로할 수 있다', ['CHASE', 'FOUND_FOOTAGE', 'HIDE_AND_SEEK']),
      e('Outlast 2', 'outlast-2', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '광신도 마을과 추격 연출이 강하게 몰아친다', '길 찾기가 어두워 답답할 때가 있다', ['CHASE', 'RELIGIOUS_HORROR', 'SURVIVAL']),
      e('Alien: Isolation', 'alien-isolation', 'LIKE', ['Horror', 'Shooter'], ['Single player'], '외계 생명체의 예측 불가능성이 계속 긴장을 만든다', '한 구역에 오래 묶이면 스트레스가 크다', ['STALKER_AI', 'SCI_FI_HORROR', 'STEALTH']),
      e('Dead Space', 'dead-space', 'LIKE', ['Horror', 'Shooter'], ['Single player'], '절단 전투와 우주선 음향이 생존 공포를 살린다', '액션 숙련이 되면 공포가 조금 줄어든다', ['SURVIVAL_HORROR', 'SCI_FI', 'BODY_HORROR']),
      e('Dead Space (2023)', 'dead-space-2023', 'LIKE', ['Horror', 'Shooter'], ['Single player'], '현대화된 조명과 사운드가 이시무라의 압박을 되살린다', '원작을 알면 일부 반전은 익숙하다', ['SURVIVAL_HORROR', 'REMAKE', 'SOUND_DESIGN']),
      e('The Evil Within', 'the-evil-within', 'LIKE', ['Horror', 'Shooter'], ['Single player'], '탄약 부족과 기괴한 장면 전환이 불안하다', '난도가 튈 때 공포보다 짜증이 앞선다', ['SURVIVAL_HORROR', 'LIMITED_RESOURCES', 'BODY_HORROR']),
      e('Phasmophobia', 'phasmophobia', 'LIKE', ['Horror', 'Simulator'], ['Co-op', 'Multiplayer'], '친구들과 증거를 모을수록 공포와 웃음이 같이 생긴다', '솔로보다 협동일 때 훨씬 좋다', ['COOP_HORROR', 'GHOST_HUNTING', 'VOICE_COMMS']),
      e('Visage', 'visage', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '집 안의 초자연 현상이 심리적으로 압박한다', '퍼즐 동선이 불친절해 흐름이 끊길 수 있다', ['PSYCHOLOGICAL_HORROR', 'HAUNTED_HOUSE', 'DREAD']),
      e('Layers of Fear', 'layers-of-fear', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '방이 뒤틀리는 연출과 예술가의 광기가 분위기를 만든다', '직접적인 위협은 적다', ['PSYCHOLOGICAL_HORROR', 'WALKING_SIM', 'ATMOSPHERE']),
      e('Until Dawn', 'until-dawn', 'LIKE', ['Horror', 'Adventure'], ['Single player'], '선택과 생존 여부가 슬래셔 영화처럼 긴장된다', 'QTE 실패가 억울하게 느껴질 때가 있다', ['INTERACTIVE_DRAMA', 'SLASHER', 'CHOICES_MATTER']),
      e('Little Nightmares', 'little-nightmares', 'MIXED', ['Horror', 'Platform'], ['Single player'], '작은 몸으로 거대한 위협을 피하는 비주얼이 훌륭하다', '플랫폼 조작 실패가 공포 몰입을 끊는다', ['CREEPY', 'PLATFORM_PUZZLE', 'ATMOSPHERE']),
      e('Alan Wake 2', 'alan-wake-2', 'MIXED', ['Horror', 'Adventure'], ['Single player'], '수사와 메타 서사가 강한 불안을 만든다', '퍼즐과 전투 리듬이 취향보다 느릴 때가 있다', ['PSYCHOLOGICAL_HORROR', 'NARRATIVE', 'INVESTIGATION']),
      e('Stardew Valley', 'stardew-valley', 'DISLIKE', ['RPG', 'Simulator'], ['Single player', 'Co-op'], '농사와 마을 관계는 편안하다', '긴장과 위협이 거의 없어 공포 취향 데이터에는 약하게 잡힌다', ['COZY_LOOP', 'FARMING', 'LOW_TENSION']),
      e('Euro Truck Simulator 2', 'euro-truck-simulator-2', 'DISLIKE', ['Simulator', 'Indie'], ['Single player'], '장거리 운전의 몰입은 있다', '공포나 생존 압박이 없어 오래 붙잡을 이유가 적다', ['DRIVING_SIM', 'RELAXED', 'LOW_TENSION']),
      e('EA Sports FC 24', 'ea-sports-fc-24', 'DISLIKE', ['Sport'], ['Single player', 'Multiplayer'], '경기 운영과 팬심은 이해된다', '스포츠 경쟁은 어둡고 불안한 분위기를 원하는 취향과 맞지 않는다', ['SPORTS', 'COMPETITIVE', 'BRIGHT_TONE']),
    ],
  },
];

const personaAccounts = [
  {
    order: 1,
    playerTypeId: 'rpg_sim_solo',
    email: 'persona-rpg-sim-solo@gaming-journal.club',
    password: 'PersonaTest!2026',
    nickname: 'RPG_SIM_SOLO_TEST',
    bio: 'RPG, 시뮬레이션, 솔로 플레이 중심의 테스트 페르소나입니다.',
    gamerTags: [
      'SOLO_PLAY',
      'RPG',
      'SIMULATION',
      'STORY_RICH',
      'RELAXED_GRIND',
      'EXPLORATION',
    ],
  },
  {
    order: 2,
    playerTypeId: 'puzzle_solo',
    email: 'persona-puzzle-solo@gaming-journal.club',
    password: 'PersonaTest!2026',
    nickname: 'PUZZLE_SOLO_TEST',
    bio: '퍼즐, 추리, 공간 사고, 솔로 플레이 중심의 테스트 페르소나입니다.',
    gamerTags: [
      'PUZZLE',
      'SOLO_PLAY',
      'LOGIC',
      'DEDUCTION',
      'SPATIAL_REASONING',
      'EUREKA',
    ],
  },
  {
    order: 3,
    playerTypeId: 'multiplayer_social',
    email: 'persona-multiplayer@gaming-journal.club',
    password: 'PersonaTest!2026',
    nickname: 'MULTIPLAYER_TEST',
    bio: '협동, PvP, 팀플레이, 실시간 소셜 루프 중심의 테스트 페르소나입니다.',
    gamerTags: [
      'MULTIPLAYER',
      'COOP',
      'PVP',
      'TEAMPLAY',
      'VOICE_COMMS',
      'META_MASTERY',
    ],
  },
  {
    order: 4,
    playerTypeId: 'horror_atmosphere',
    email: 'persona-horror@gaming-journal.club',
    password: 'PersonaTest!2026',
    nickname: 'HORROR_TEST',
    bio: '공포, 생존, 불안한 분위기, 사운드 디자인 중심의 테스트 페르소나입니다.',
    gamerTags: [
      'HORROR',
      'ATMOSPHERE',
      'SURVIVAL',
      'DREAD',
      'SOUND_DESIGN',
      'LIMITED_RESOURCES',
    ],
  },
];

function e(title, slug, signal, genres, playModes, note, friction, keywords, platform = 'PC') {
  return {
    title,
    slug,
    signal,
    genres,
    playModes,
    note,
    friction,
    keywords,
    platform,
  };
}

function pick(values, index) {
  return values[index % values.length];
}

function ratingFor(signal, index) {
  return pick(preferenceScale[signal].reviewRatings, index);
}

function scoreFor(signal, index) {
  return pick(preferenceScale[signal].scores, index);
}

function buildTitle(game, profile, type, index) {
  const positive = [
    `${game.title}: 내 취향을 또렷하게 보여준 기록`,
    `${game.title}에서 찾은 오래 붙잡을 이유`,
    `${game.title}은 ${profile.name}에게 잘 맞았다`,
  ];
  const mixed = [
    `${game.title}: 좋은 점과 마찰이 함께 남았다`,
    `${game.title}은 일부만 내 취향이었다`,
    `${game.title} 플레이 후 남은 애매한 감정`,
  ];
  const negative = [
    `${game.title}은 완성도와 별개로 내 취향 밖이었다`,
    `${game.title}에서 선호 키워드가 약하게 잡혔다`,
    `${game.title}은 오래 붙잡기 어려웠다`,
  ];

  const bucket =
    game.signal === 'LIKE' ? positive : game.signal === 'MIXED' ? mixed : negative;
  return `${type === 'JOURNAL' ? '저널' : '리뷰'} - ${pick(bucket, index)}`;
}

function buildContent(game, profile, type, index) {
  const likeReview = [
    `${game.title}은 ${profile.positiveFrame} 취향과 잘 맞았다. 특히 ${game.note}는 점이 좋았고, 플레이 시간이 쌓일수록 ${game.keywords.slice(0, 2).join(', ')} 키워드가 선명해졌다. 추천 모델에서는 이 게임을 강한 긍정 신호로 써도 좋다.`,
    `${game.title}을 플레이하는 동안 급하게 몰아치는 느낌보다 스스로 목표를 정하는 감각이 컸다. ${game.note}는 점 때문에 다시 켜고 싶은 마음이 생겼고, ${profile.dominantKeywords.slice(0, 3).join(', ')} 성향을 잘 설명한다.`,
    `완성도보다 더 중요하게 느껴진 것은 플레이 리듬이었다. ${game.title}은 ${game.note}는 구조 덕분에 오래 붙잡기 쉬웠고, 내 선호 장르를 설명하는 대표 사례에 가깝다.`,
  ];
  const likeJournal = [
    `오늘 플레이한 게임은 ${game.title}이다. ${game.note}는 점이 특히 기억에 남았고, ${profile.journalFrame} 경험을 좋아한다는 사실을 다시 확인했다.`,
    `${game.title}을 짧게 켰다가 예상보다 오래 했다. ${game.note}는 점 때문에 다음 목표가 자연스럽게 생겼고, 이 기록은 긍정 선호 데이터로 분류할 수 있다.`,
    `${game.title} 세션에서는 억지로 숙제를 한다는 느낌이 적었다. ${profile.journalFrame} 흐름과 ${game.keywords[0]} 요소가 맞물려 편하게 몰입했다.`,
  ];
  const mixedReview = [
    `${game.title}은 분명 매력적인 게임이다. ${game.note}는 점은 좋았지만, ${game.friction}는 부분 때문에 선호 신호가 완전히 긍정으로 가지는 않았다. 추천에는 보조 신호로만 반영하는 편이 맞다.`,
    `${game.title}에서 재미를 느낀 순간은 있었다. 다만 ${game.friction}는 점이 반복되면서 내 핵심 취향과 거리가 생겼고, 장르 키워드는 긍정과 주의를 함께 달아야 한다.`,
    `${game.title}은 취향의 경계에 있는 게임이었다. ${game.note}는 점은 좋았지만 ${game.friction}는 점이 오래 플레이하는 데 방해가 됐다.`,
  ];
  const mixedJournal = [
    `오늘 ${game.title}을 하며 취향이 갈리는 지점을 메모했다. ${game.note}는 좋았지만 ${game.friction}는 이유로 오래 이어 하지는 못했다.`,
    `${game.title}은 첫인상보다 복잡한 감정이 남았다. 좋아하는 요소와 피로한 요소가 같이 있어서, 분석 모델에는 혼합 선호로 넣는 것이 적절하다.`,
    `${game.title} 세션은 나쁘지 않았지만 확실한 추천 기준으로 삼기에는 애매했다. ${game.friction}는 점이 선호 키워드의 강도를 낮춘다.`,
  ];
  const dislikeReview = [
    `${game.title}은 장점이 보였지만 내 취향과는 멀었다. 특히 ${game.friction}는 점 때문에 오래 붙잡기 어려웠고, ${profile.avoidanceKeywords.slice(0, 2).join(', ')} 회피 신호가 강하게 잡혔다.`,
    `${game.title}을 평가하면 완성도와 선호도는 따로 봐야 한다. ${game.note}는 부분은 인정하지만 ${game.friction}는 점이 더 크게 다가와 낮은 선호로 남았다.`,
    `추천 모델 관점에서 ${game.title}은 부정 샘플에 가깝다. ${game.friction}는 요소가 내 플레이 동기를 꺾었고, 선호 장르와 감정 리듬이 맞지 않았다.`,
  ];
  const dislikeJournal = [
    `오늘 ${game.title}을 시도했지만 금방 피로해졌다. ${game.friction}는 점이 계속 신경 쓰였고, 내가 원하는 플레이 감각과 다르다는 결론이 났다.`,
    `${game.title} 기록은 비선호 사례로 남긴다. ${game.note}는 장점은 있었지만 ${game.friction}는 이유가 훨씬 크게 느껴졌다.`,
    `${game.title} 세션을 끝내고 나니 다음에 다시 켤 이유가 약했다. ${profile.avoidanceKeywords[0]} 성향을 감지하는 데 좋은 부정 데이터가 될 것 같다.`,
  ];

  if (game.signal === 'LIKE') {
    return type === 'JOURNAL' ? pick(likeJournal, index) : pick(likeReview, index);
  }

  if (game.signal === 'MIXED') {
    return type === 'JOURNAL'
      ? pick(mixedJournal, index)
      : pick(mixedReview, index);
  }

  return type === 'JOURNAL'
    ? pick(dislikeJournal, index)
    : pick(dislikeReview, index);
}

function toRecord(profile, game, index) {
  const type = index % 3 === 0 ? 'JOURNAL' : 'REVIEW';
  const id = `${profile.id}-${String(index + 1).padStart(3, '0')}`;
  const signalMeta = preferenceScale[game.signal];

  return {
    id,
    generated_at: GENERATED_AT,
    source: 'synthetic_original_ko',
    player_type_id: profile.id,
    player_type_name: profile.name,
    sample_index: index + 1,
    type,
    label_target: signalMeta.label,
    preference_signal: game.signal,
    preference_score: scoreFor(game.signal, index),
    rating: type === 'REVIEW' ? ratingFor(game.signal, index) : null,
    game_title: game.title,
    igdb_game_id: null,
    igdb_lookup_query: game.title,
    igdb_slug: game.slug,
    igdb_source_url: `https://www.igdb.com/games/${game.slug}`,
    igdb_match_status: 'slug_hint_only',
    game_platform: game.platform,
    primary_genres: game.genres,
    play_modes: game.playModes,
    title: buildTitle(game, profile, type, index),
    content: buildContent(game, profile, type, index),
    preference_keywords: [
      ...new Set([...profile.dominantKeywords, ...game.keywords]),
    ].slice(0, 10),
    avoidance_keywords:
      game.signal === 'LIKE'
        ? []
        : [...new Set([...profile.avoidanceKeywords, ...game.keywords])].slice(0, 8),
    notes_for_model:
      game.signal === 'LIKE'
        ? '이 플레이어 유형의 추천 후보에 가깝다.'
        : game.signal === 'MIXED'
          ? '일부 키워드는 맞지만 마찰 요인을 함께 학습해야 한다.'
          : '이 플레이어 유형의 비추천 또는 낮은 우선순위 후보에 가깝다.',
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = Array.isArray(value) ? value.join('|') : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key];
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function assertCounts(records) {
  for (const profile of profiles) {
    const count = records.filter((record) => record.player_type_id === profile.id)
      .length;

    if (count !== profile.expectedCount) {
      throw new Error(
        `${profile.id} expected ${profile.expectedCount} records but generated ${count}.`,
      );
    }
  }

  const expectedTotal = profiles.reduce(
    (total, profile) => total + profile.expectedCount,
    0,
  );

  if (records.length !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} total records but got ${records.length}.`);
  }
}

function accountForProfile(profile) {
  const account = personaAccounts.find(
    (candidate) => candidate.playerTypeId === profile.id,
  );

  if (!account) {
    throw new Error(`Missing persona account for ${profile.id}.`);
  }

  return account;
}

function profileFilePrefix(profile) {
  const account = accountForProfile(profile);
  return `${String(account.order).padStart(2, '0')}_${profile.id}`;
}

function toPostCreatePayload(record) {
  const payload = {
    type: record.type,
    gameTitle: record.game_title,
    gamePlatform: record.game_platform,
    title: record.title,
    content: record.content,
    tags: record.preference_keywords.slice(0, 6),
  };

  if (record.igdb_game_id) {
    payload.igdbGameId = record.igdb_game_id;
  }

  if (record.type === 'REVIEW') {
    payload.rating = record.rating;
  }

  return payload;
}

function writeRecordBundle(basePath, records, headers) {
  fs.writeFileSync(`${basePath}.json`, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    `${basePath}.jsonl`,
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    'utf8',
  );
  fs.writeFileSync(
    `${basePath}.csv`,
    `${headers.join(',')}\n${records
      .map((record) => headers.map((header) => csvEscape(record[header])).join(','))
      .join('\n')}\n`,
    'utf8',
  );
}

function writePersonaFiles(records, headers) {
  const personaDir = path.join(__dirname, PERSONA_OUTPUT_DIR);
  fs.mkdirSync(personaDir, { recursive: true });

  const accountRows = [];

  for (const profile of profiles) {
    const account = accountForProfile(profile);
    const filePrefix = profileFilePrefix(profile);
    const profileRecords = records.filter(
      (record) => record.player_type_id === profile.id,
    );
    const basePath = path.join(personaDir, filePrefix);

    writeRecordBundle(basePath, profileRecords, headers);

    const importPayload = {
      generated_at: GENERATED_AT,
      account: {
        email: account.email,
        password: account.password,
        nickname: account.nickname,
        bio: account.bio,
        gamerTags: account.gamerTags,
      },
      player_type: {
        id: profile.id,
        name: profile.name,
        dominantKeywords: profile.dominantKeywords,
        avoidanceKeywords: profile.avoidanceKeywords,
      },
      post_count: profileRecords.length,
      counts_by_signal: countBy(profileRecords, 'preference_signal'),
      counts_by_type: countBy(profileRecords, 'type'),
      posts: profileRecords.map(toPostCreatePayload),
    };

    fs.writeFileSync(
      path.join(personaDir, `${filePrefix}_import_payload.json`),
      `${JSON.stringify(importPayload, null, 2)}\n`,
      'utf8',
    );

    accountRows.push({
      order: account.order,
      player_type_id: profile.id,
      player_type_name: profile.name,
      email: account.email,
      password: account.password,
      nickname: account.nickname,
      bio: account.bio,
      gamerTags: account.gamerTags,
      post_count: profileRecords.length,
      records_json: `${PERSONA_OUTPUT_DIR}/${filePrefix}.json`,
      records_jsonl: `${PERSONA_OUTPUT_DIR}/${filePrefix}.jsonl`,
      records_csv: `${PERSONA_OUTPUT_DIR}/${filePrefix}.csv`,
      import_payload: `${PERSONA_OUTPUT_DIR}/${filePrefix}_import_payload.json`,
    });
  }

  fs.writeFileSync(
    path.join(__dirname, 'test_persona_accounts.json'),
    `${JSON.stringify(accountRows, null, 2)}\n`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(personaDir, 'README.md'),
    `# Persona Split Dataset

4개 테스트 계정별로 분리한 리뷰/저널 데이터입니다.

## Accounts

| 순서 | 플레이어 유형 | 이메일 | 비밀번호 | 게시글 |
| --- | --- | --- | --- | --- |
${accountRows
  .map(
    (account) =>
      `| ${account.order} | ${account.player_type_name} | \`${account.email}\` | \`${account.password}\` | ${account.post_count} |`,
  )
  .join('\n')}

## File Pattern

- \`NN_player_type.json\`: 해당 페르소나 원본 레코드 배열
- \`NN_player_type.jsonl\`: 해당 페르소나 JSON Lines
- \`NN_player_type.csv\`: 해당 페르소나 CSV
- \`NN_player_type_import_payload.json\`: 테스트 계정 정보와 \`POST /posts\`에 넣기 쉬운 게시글 payload 목록
`,
    'utf8',
  );

  return accountRows;
}

function writeDataset(records) {
  const summaryPath = path.join(__dirname, 'summary.json');
  const readmePath = path.join(__dirname, 'README.md');

  const headers = [
    'id',
    'player_type_id',
    'player_type_name',
    'sample_index',
    'type',
    'label_target',
    'preference_signal',
    'preference_score',
    'rating',
    'game_title',
    'igdb_game_id',
    'igdb_lookup_query',
    'igdb_slug',
    'igdb_source_url',
    'igdb_match_status',
    'game_platform',
    'primary_genres',
    'play_modes',
    'title',
    'content',
    'preference_keywords',
    'avoidance_keywords',
    'notes_for_model',
    'source',
    'generated_at',
  ];

  writeRecordBundle(path.join(__dirname, DATASET_BASENAME), records, headers);
  const personaAccountRows = writePersonaFiles(records, headers);

  const summary = {
    generated_at: GENERATED_AT,
    total_records: records.length,
    source: 'synthetic_original_ko',
    igdb_note:
      'Rows use IGDB title lookup queries, slug hints, and source URL hints. Numeric igdb_game_id is null because this offline generator does not call the IGDB API.',
    test_accounts_file: 'test_persona_accounts.json',
    split_output_dir: PERSONA_OUTPUT_DIR,
    counts_by_player_type: profiles.map((profile) => ({
      player_type_id: profile.id,
      player_type_name: profile.name,
      expected_count: profile.expectedCount,
      actual_count: records.filter((record) => record.player_type_id === profile.id)
        .length,
      counts_by_signal: countBy(
        records.filter((record) => record.player_type_id === profile.id),
        'preference_signal',
      ),
      counts_by_type: countBy(
        records.filter((record) => record.player_type_id === profile.id),
        'type',
      ),
      import_payload: `${PERSONA_OUTPUT_DIR}/${profileFilePrefix(profile)}_import_payload.json`,
    })),
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  fs.writeFileSync(
    readmePath,
    `# Player Preference IGDB Reviews/Journals Dataset

게임 스타일 및 선호 장르 키워드 분석 AI를 위한 합성 한국어 데이터셋입니다.

## Files

- \`${DATASET_BASENAME}.json\`: 전체 레코드를 JSON 배열로 저장한 파일
- \`${DATASET_BASENAME}.jsonl\`: 학습/임베딩 파이프라인에 넣기 쉬운 JSON Lines 파일
- \`${DATASET_BASENAME}.csv\`: 스프레드시트 확인용 CSV 파일
- \`summary.json\`: 플레이어 유형, 선호 신호, REVIEW/JOURNAL 카운트 요약
- \`test_persona_accounts.json\`: 4개 테스트 페르소나 계정 목록
- \`${PERSONA_OUTPUT_DIR}/\`: 계정별로 분리된 JSON/JSONL/CSV와 import payload
- \`generate-player-preference-dataset.mjs\`: 데이터셋 재생성 스크립트

## Scope

- 총 ${records.length}개 레코드
- RPG/시뮬레이션 솔로 선호: 40개
- 퍼즐 솔로 선호: 80개
- 멀티플레이 선호: 20개
- 공포 게임 선호: 20개

## Test Accounts

| 순서 | 플레이어 유형 | 이메일 | 비밀번호 | 게시글 |
| --- | --- | --- | --- | --- |
${personaAccountRows
  .map(
    (account) =>
      `| ${account.order} | ${account.player_type_name} | \`${account.email}\` | \`${account.password}\` | ${account.post_count} |`,
  )
  .join('\n')}

각 계정의 \`${PERSONA_OUTPUT_DIR}/*_import_payload.json\` 파일에는 계정 정보와 게시글 생성 payload가 함께 들어 있습니다.

## Schema

- \`type\`: \`REVIEW\` 또는 \`JOURNAL\`
- \`label_target\`: \`positive_preference\`, \`mixed_preference\`, \`negative_preference\`
- \`preference_signal\`: \`LIKE\`, \`MIXED\`, \`DISLIKE\`
- \`preference_score\`: -1.0부터 1.0 사이의 분석용 선호 점수
- \`rating\`: REVIEW에만 있는 1-5점 평점, JOURNAL은 \`null\`
- \`game_title\`, \`igdb_lookup_query\`, \`igdb_slug\`, \`igdb_source_url\`: IGDB 기준 게임 참조 필드
- \`igdb_match_status\`: \`slug_hint_only\`; 숫자형 IGDB id는 후속 hydrate 대상
- \`preference_keywords\`: 선호 장르/플레이 스타일 키워드
- \`avoidance_keywords\`: 비선호 또는 마찰 요인 키워드

## Notes

본문은 실제 유저 리뷰를 수집한 것이 아니라, 모델 학습/테스트를 위해 새로 작성한 합성 원문입니다. 게임 타이틀은 IGDB에 등재된 공개 타이틀 기준으로 선정했습니다. 생성기는 외부 API를 직접 호출하지 않는 오프라인 방식이므로 숫자형 \`igdb_game_id\`는 \`null\`로 두었습니다. 추후 \`igdb_lookup_query\`, \`igdb_slug\`, \`igdb_source_url\`를 기준으로 서버의 IGDB 검색 API를 통해 보강할 수 있습니다.
`,
    'utf8',
  );
}

const records = profiles.flatMap((profile) =>
  profile.games.map((game, index) => toRecord(profile, game, index)),
);

assertCounts(records);
writeDataset(records);

console.log(
  JSON.stringify(
    {
      ok: true,
      totalRecords: records.length,
      byProfile: Object.fromEntries(
        profiles.map((profile) => [
          profile.id,
          records.filter((record) => record.player_type_id === profile.id).length,
        ]),
      ),
    },
    null,
    2,
  ),
);
