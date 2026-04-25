export const cardRanks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export const cardSuits = ['clubs', 'diamonds', 'hearts', 'spades'] as const;

export type CardRank = (typeof cardRanks)[number];
export type CardSuit = (typeof cardSuits)[number];

export interface PlayingCard {
  rank: CardRank;
  suit: CardSuit;
}

const pokerRankValueMap: Record<CardRank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

export const getBlackjackCardValue = (card: PlayingCard): number => {
  if (card.rank === 'A') {
    return 11;
  }

  if (['K', 'Q', 'J'].includes(card.rank)) {
    return 10;
  }

  return Number(card.rank);
};

export const getPokerRankValue = (card: PlayingCard): number => pokerRankValueMap[card.rank];

export const createDeck = (): PlayingCard[] =>
  cardSuits.flatMap((suit) => cardRanks.map((rank) => ({ rank, suit })));

export const shuffleDeck = (deck: PlayingCard[]): PlayingCard[] => {
  const cards = [...deck];

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }

  return cards;
};

export const drawCard = (deck: PlayingCard[]): PlayingCard => {
  const card = deck.shift();

  if (!card) {
    throw new Error('Deck is empty.');
  }

  return card;
};
