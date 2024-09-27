import { getChoseong } from "es-hangul";

const USER = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "user1@example.com",
    name: "김철수",
    password: "password1", // 간단한 비밀번호
    isAdmin: false,
    createdAt: "2021-03-15T09:30:00Z",
    updatedAt: "2024-09-19T14:20:00Z",
  },
  {
    id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    email: "user2@example.com",
    name: "이영희",
    password: "password2",
    isAdmin: false,
    createdAt: "2022-07-22T15:45:00Z",
    updatedAt: "2024-09-19T14:21:00Z",
  },
  {
    id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    email: "user3@example.com",
    name: "박민수",
    password: "password3",
    isAdmin: false,
    createdAt: "2023-01-10T11:20:00Z",
    updatedAt: "2024-09-19T14:22:00Z",
  },
  {
    id: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    email: "user4@example.com",
    name: "정지은",
    password: "password4",
    isAdmin: false,
    createdAt: "2023-09-05T08:15:00Z",
    updatedAt: "2024-09-19T14:23:00Z",
  },
];

const POST = [
  {
    id: 1,
    slug: "인공지능의-미래",
    coverImg: "https://via.placeholder.com/600x400",
    category: "기술",
    title: "인공지능의 미래",
    choseongTitle: getChoseong("인공지능의 미래"),
    content:
      "인공지능 기술이 빠르게 발전하고 있습니다. 이에 따라 우리의 일상생활과 산업 전반에 큰 변화가 예상됩니다...",
    tags: ["AI", "기술", "미래"],
    likes: 42,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-09-19T14:30:00Z",
    userId: "550e8400-e29b-41d4-a716-446655440000",
  },
  {
    id: 2,
    slug: "양자-컴퓨팅의-혁명적-발전",
    coverImg: "https://via.placeholder.com/600x400",
    category: "과학",
    title: "양자 컴퓨팅의 혁명적 발전",
    choseongTitle: getChoseong("양자 컴퓨팅의 혁명적 발전"),
    content:
      "과학자들이 양자 컴퓨팅 분야에서 중요한 돌파구를 마련했습니다. 이번 발견으로 복잡한 문제 해결 능력이 크게 향상될 전망입니다...",
    tags: ["양자", "컴퓨팅", "과학"],
    likes: 38,
    createdAt: "2024-02-20T14:30:00Z",
    updatedAt: "2024-09-19T14:31:00Z",
    userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  },
  {
    id: 3,
    slug: "2024-올림픽-하이라이트",
    coverImg: "https://via.placeholder.com/600x400",
    category: "스포츠",
    title: "2024 올림픽 하이라이트",
    choseongTitle: getChoseong("2024 올림픽 하이라이트"),
    content: "2024년 올림픽이 성공적으로 막을 내렸습니다. 이번 대회에서는 여러 새로운 세계 기록이 수립되었으며...",
    tags: ["올림픽", "스포츠", "2024"],
    likes: 55,
    createdAt: "2024-03-10T09:15:00Z",
    updatedAt: "2024-09-19T14:32:00Z",
    userId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  },
  {
    id: 4,
    slug: "기대작-영화-개봉",
    coverImg: "https://via.placeholder.com/600x400",
    category: "엔터테인먼트",
    title: "기대작 영화 개봉",
    choseongTitle: getChoseong("기대작 영화 개봉"),
    content: "작년 최고 흥행작의 후속편이 드디어 개봉했습니다. 관객들의 반응은...",
    tags: ["영화", "엔터테인먼트", "속편"],
    likes: 67,
    createdAt: "2024-04-05T20:00:00Z",
    updatedAt: "2024-09-19T14:33:00Z",
    userId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  },
  {
    id: 5,
    slug: "웹3.0의-부상",
    coverImg: "https://via.placeholder.com/600x400",
    category: "기술",
    title: "웹3.0의 부상",
    choseongTitle: getChoseong("웹3.0의 부상"),
    content: "웹3.0 기술이 우리가 알고 있는 인터넷을 변화시키고 있습니다. 이는 어떤 의미를 가지고 있을까요?...",
    tags: ["웹3", "블록체인", "암호화폐"],
    likes: 31,
    createdAt: "2024-05-12T11:45:00Z",
    updatedAt: "2024-09-19T14:34:00Z",
    userId: "550e8400-e29b-41d4-a716-446655440000",
  },
  {
    id: 6,
    slug: "화성-정착-계획",
    coverImg: "https://via.placeholder.com/600x400",
    category: "과학",
    title: "화성 정착 계획",
    choseongTitle: getChoseong("화성 정착 계획"),
    content: "우주 기관들이 화성 정착을 위한 최신 계획을 발표했습니다. 이 계획에는 어떤 내용이 포함되어 있을까요?...",
    tags: ["우주", "화성", "정착"],
    likes: 49,
    createdAt: "2024-06-18T16:20:00Z",
    updatedAt: "2024-09-19T14:35:00Z",
    userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  },
  {
    id: 7,
    slug: "2026-월드컵-개최-도시-발표",
    coverImg: "https://via.placeholder.com/600x400",
    category: "스포츠",
    title: "2026 월드컵 개최 도시 발표",
    choseongTitle: getChoseong("2026 월드컵 개최 도시 발표"),
    content: "FIFA가 2026년 월드컵 개최 도시를 발표했습니다. 어떤 도시들이 선정되었을까요?...",
    tags: ["월드컵", "축구", "2026"],
    likes: 73,
    createdAt: "2024-07-22T13:10:00Z",
    updatedAt: "2024-09-19T14:36:00Z",
    userId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  },
  {
    id: 8,
    slug: "가상현실-콘서트,-새-기록-수립",
    coverImg: "https://via.placeholder.com/600x400",
    category: "엔터테인먼트",
    title: "가상현실 콘서트, 새 기록 수립",
    choseongTitle: getChoseong("가상현실 콘서트, 새 기록 수립"),
    content: "혁신적인 가상현실 콘서트가 수백만 명의 시청자를 끌어모았습니다. 이 콘서트의 특별한 점은 무엇일까요?...",
    tags: ["VR", "콘서트", "음악"],
    likes: 61,
    createdAt: "2024-08-30T19:55:00Z",
    updatedAt: "2024-09-19T14:37:00Z",
    userId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  },
  {
    id: 9,
    slug: "혁명적인-배터리-기술",
    coverImg: "https://via.placeholder.com/600x400",
    category: "기술",
    title: "혁명적인 배터리 기술",
    choseongTitle: getChoseong("혁명적인 배터리 기술"),
    content: "새로운 배터리 기술이 전자기기의 수명을 두 배로 늘릴 수 있다고 합니다. 이 기술의 원리는 무엇일까요?...",
    tags: ["배터리", "기술", "혁신"],
    likes: 52,
    createdAt: "2024-09-05T08:40:00Z",
    updatedAt: "2024-09-19T14:38:00Z",
    userId: "550e8400-e29b-41d4-a716-446655440000",
  },
  {
    id: 10,
    slug: "핵융합-에너지-돌파구",
    coverImg: "https://via.placeholder.com/600x400",
    category: "과학",
    title: "핵융합 에너지 돌파구",
    choseongTitle: getChoseong("핵융합 에너지 돌파구"),
    content: "과학자들이 핵융합 반응에서 순양성 에너지 출력을 달성했습니다. 이는 어떤 의미를 가지고 있을까요?...",
    tags: ["핵융합", "에너지", "물리학"],
    likes: 45,
    createdAt: "2024-09-15T12:25:00Z",
    updatedAt: "2024-09-19T14:39:00Z",
    userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  },
];

const COMMENT = [
  {
    id: 1,
    content: "정말 좋은 글이에요! AI의 미래에 대해 많은 것을 배웠습니다.",
    likes: 5,
    createdAt: "2024-01-16T14:00:00Z",
    updatedAt: "2024-09-19T14:40:00Z",
    userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    postId: 1,
    parentCommentId: null,
  },
  {
    id: 2,
    content: "동의합니다. 잠재적인 응용 분야가 정말 놀랍네요!",
    likes: 3,
    createdAt: "2024-01-17T10:30:00Z",
    updatedAt: "2024-09-19T14:41:00Z",
    userId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    postId: 1,
    parentCommentId: 1,
  },
  {
    id: 3,
    content: "양자 컴퓨팅이 암호학을 혁명적으로 바꿀 것 같아요.",
    likes: 7,
    createdAt: "2024-02-21T09:15:00Z",
    updatedAt: "2024-09-19T14:42:00Z",
    userId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    postId: 2,
    parentCommentId: null,
  },
  {
    id: 4,
    content: "이 기술이 우리 일상생활에 어떤 영향을 미칠지 정말 궁금해요!",
    likes: 2,
    createdAt: "2024-02-22T16:45:00Z",
    updatedAt: "2024-09-19T14:43:00Z",
    userId: "550e8400-e29b-41d4-a716-446655440000",
    postId: 2,
    parentCommentId: 3,
  },
  {
    id: 5,
    content: "이번 올림픽은 정말 흥미진진했어요!",
    likes: 9,
    createdAt: "2024-03-11T11:20:00Z",
    updatedAt: "2024-09-19T14:44:00Z",
    userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    postId: 3,
    parentCommentId: null,
  },
  {
    id: 6,
    content: "새 영화가 원작에 비해 좀 실망스러웠어요.",
    likes: 4,
    createdAt: "2024-04-06T22:10:00Z",
    updatedAt: "2024-09-19T14:45:00Z",
    userId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    postId: 4,
    parentCommentId: null,
  },
  {
    id: 7,
    content: "웹3.0이 과대평가된 것 같아요. 다른 분들은 어떻게 생각하시나요?",
    likes: 1,
    createdAt: "2024-05-13T14:30:00Z",
    updatedAt: "2024-09-19T14:46:00Z",
    userId: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    postId: 5,
    parentCommentId: null,
  },
  {
    id: 8,
    content: "화성 정착 계획이 흥미롭지만 동시에 두렵기도 해요!",
    likes: 6,
    createdAt: "2024-06-19T09:40:00Z",
    updatedAt: "2024-09-19T14:47:00Z",
    userId: "550e8400-e29b-41d4-a716-446655440000",
    postId: 6,
    parentCommentId: null,
  },
];

export { USER, POST, COMMENT };
