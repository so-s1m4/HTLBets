import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CardDeckService } from '../../../core/services/card-deck.service';
import { BALATRO_JOKERS, type JokerDefinition } from '../balatro/balatro-jokers';
import { GameShellComponent } from '../components/game-shell.component';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
type GamePhase = 'blind-select' | 'playing' | 'shop';
type HandName =
  | 'High Card'
  | 'Pair'
  | 'Two Pair'
  | 'Three of a Kind'
  | 'Straight'
  | 'Flush'
  | 'Full House'
  | 'Four of a Kind'
  | 'Straight Flush';

interface PlayingCard {
  id: string;
  rank: Rank;
  suit: Suit;
  selected: boolean;
}

interface OwnedJoker extends JokerDefinition {
  instanceId: string;
  sellValue: number;
}

interface HandResult {
  name: HandName | 'Choose cards';
  chips: number;
  mult: number;
  xMult: number;
  score: number;
  money: number;
  scoringIds: Set<string>;
}

interface BlindOption {
  index: number;
  name: string;
  type: 'small' | 'big' | 'boss';
  target: number;
  reward: number;
  status: 'current' | 'cleared' | 'locked';
  glyph: string;
  tag: string;
}

interface DeckSuitRow {
  suit: Suit;
  label: string;
  cards: Array<{ rank: Rank; card: PlayingCard | null }>;
}

type ConsumableKind = 'glitch' | 'protocol';

interface ConsumableDefinition {
  id: string;
  name: string;
  kind: ConsumableKind;
  cost: number;
  glyph: string;
  accent: string;
  effect: string;
  money?: number;
  nextChips?: number;
  nextMult?: number;
  nextXMult?: number;
  hand?: HandName;
}

interface OwnedConsumable extends ConsumableDefinition {
  instanceId: string;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const DECK_VIEW_SUITS: Array<{ suit: Suit; label: string }> = [
  { suit: 'hearts', label: 'Hearts' },
  { suit: 'spades', label: 'Spades' },
  { suit: 'diamonds', label: 'Diamonds' },
  { suit: 'clubs', label: 'Clubs' }
];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 10, Q: 10, K: 10, A: 11
};
const POKER_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14
};
const BLIND_NAMES = ['Small Blind', 'Big Blind', 'The Hook'] as const;
const MAX_ANTE = 8;
const ANTE_BASE_TARGETS = [300, 800, 2_000, 5_000, 11_000, 20_000, 35_000, 50_000] as const;
const BLIND_TARGET_MULTIPLIERS = [1, 1.5, 2] as const;
const BLIND_REWARDS = [3, 4, 5] as const;
const HAND_BASE_CHIPS: Record<HandName, number> = {
  'High Card': 5,
  Pair: 10,
  'Two Pair': 20,
  'Three of a Kind': 30,
  Straight: 30,
  Flush: 35,
  'Full House': 40,
  'Four of a Kind': 60,
  'Straight Flush': 100
};
const HAND_BASE_MULT: Record<HandName, number> = {
  'High Card': 1,
  Pair: 2,
  'Two Pair': 2,
  'Three of a Kind': 3,
  Straight: 4,
  Flush: 4,
  'Full House': 4,
  'Four of a Kind': 7,
  'Straight Flush': 8
};
const HAND_LEVEL_GROWTH: Record<HandName, { chips: number; mult: number }> = {
  'High Card': { chips: 10, mult: 1 },
  Pair: { chips: 15, mult: 1 },
  'Two Pair': { chips: 20, mult: 1 },
  'Three of a Kind': { chips: 20, mult: 2 },
  Straight: { chips: 30, mult: 2 },
  Flush: { chips: 25, mult: 2 },
  'Full House': { chips: 35, mult: 2 },
  'Four of a Kind': { chips: 45, mult: 3 },
  'Straight Flush': { chips: 60, mult: 4 }
};
const INITIAL_HAND_LEVELS = Object.fromEntries(
  Object.keys(HAND_BASE_CHIPS).map((name) => [name, 1])
) as Record<HandName, number>;
const CONSUMABLES: ConsumableDefinition[] = [
  {
    id: 'cash-pulse',
    name: 'Cash Pulse',
    kind: 'glitch',
    cost: 3,
    glyph: '$',
    accent: '#ffda55',
    effect: 'Inject $6 into the run immediately.',
    money: 6
  },
  {
    id: 'chip-cache',
    name: 'Chip Cache',
    kind: 'glitch',
    cost: 4,
    glyph: '+',
    accent: '#27b8ef',
    effect: 'The next played hand gains +60 Chips.',
    nextChips: 60
  },
  {
    id: 'redline',
    name: 'Redline',
    kind: 'glitch',
    cost: 4,
    glyph: '×',
    accent: '#ff5267',
    effect: 'The next played hand gains +6 Mult.',
    nextMult: 6
  },
  {
    id: 'phase-doubler',
    name: 'Phase Doubler',
    kind: 'glitch',
    cost: 6,
    glyph: 'Ⅱ',
    accent: '#bc74ff',
    effect: 'The next played hand gains ×1.5 Mult.',
    nextXMult: 1.5
  },
  {
    id: 'signal-burst',
    name: 'Signal Burst',
    kind: 'glitch',
    cost: 7,
    glyph: '!',
    accent: '#f49742',
    effect: 'The next played hand gains +35 Chips and +4 Mult.',
    nextChips: 35,
    nextMult: 4
  },
  {
    id: 'pair-loop',
    name: 'Pair Loop',
    kind: 'protocol',
    cost: 3,
    glyph: '2',
    accent: '#49c5ff',
    effect: 'Permanently upgrades Pair by one level.',
    hand: 'Pair'
  },
  {
    id: 'dual-stack',
    name: 'Dual Stack',
    kind: 'protocol',
    cost: 4,
    glyph: '4',
    accent: '#6de2b1',
    effect: 'Permanently upgrades Two Pair by one level.',
    hand: 'Two Pair'
  },
  {
    id: 'triplex-core',
    name: 'Triplex Core',
    kind: 'protocol',
    cost: 4,
    glyph: '3',
    accent: '#ff7f6d',
    effect: 'Permanently upgrades Three of a Kind by one level.',
    hand: 'Three of a Kind'
  },
  {
    id: 'sequence-driver',
    name: 'Sequence Driver',
    kind: 'protocol',
    cost: 5,
    glyph: '→',
    accent: '#ffc85a',
    effect: 'Permanently upgrades Straight by one level.',
    hand: 'Straight'
  },
  {
    id: 'flush-matrix',
    name: 'Flush Matrix',
    kind: 'protocol',
    cost: 5,
    glyph: '◆',
    accent: '#40d6c5',
    effect: 'Permanently upgrades Flush by one level.',
    hand: 'Flush'
  },
  {
    id: 'full-stack',
    name: 'Full Stack',
    kind: 'protocol',
    cost: 5,
    glyph: '▦',
    accent: '#f09cda',
    effect: 'Permanently upgrades Full House by one level.',
    hand: 'Full House'
  },
  {
    id: 'quad-array',
    name: 'Quad Array',
    kind: 'protocol',
    cost: 6,
    glyph: '4×',
    accent: '#ff665e',
    effect: 'Permanently upgrades Four of a Kind by one level.',
    hand: 'Four of a Kind'
  },
  {
    id: 'royal-circuit',
    name: 'Royal Circuit',
    kind: 'protocol',
    cost: 8,
    glyph: '★',
    accent: '#ffd75c',
    effect: 'Permanently upgrades Straight Flush by one level.',
    hand: 'Straight Flush'
  }
];

@Component({
  selector: 'app-balatro-page',
  standalone: true,
  imports: [GameShellComponent],
  templateUrl: './balatro.page.html',
  styleUrl: './balatro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BalatroPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly cardDeckService = inject(CardDeckService);
  private loadedDeckId: string | null = null;

  readonly BALATRO_JOKERS = BALATRO_JOKERS;
  readonly phase = signal<GamePhase>('blind-select');
  readonly hand = signal<PlayingCard[]>([]);
  readonly deck = signal<PlayingCard[]>([]);
  readonly score = signal(0);
  readonly handsLeft = signal(4);
  readonly discardsLeft = signal(3);
  readonly ante = signal(1);
  readonly blindIndex = signal(0);
  readonly money = signal(4);
  readonly ownedJokers = signal<OwnedJoker[]>([]);
  readonly shopOffers = signal<JokerDefinition[]>([]);
  readonly consumables = signal<OwnedConsumable[]>([]);
  readonly consumableOffers = signal<ConsumableDefinition[]>([]);
  readonly selectedConsumable = signal<ConsumableDefinition | null>(null);
  readonly hoveredConsumable = signal<ConsumableDefinition | null>(null);
  readonly handLevels = signal<Record<HandName, number>>({ ...INITIAL_HAND_LEVELS });
  readonly nextHandChips = signal(0);
  readonly nextHandMult = signal(0);
  readonly nextHandXMult = signal(1);
  readonly selectedJoker = signal<JokerDefinition | null>(null);
  readonly hoveredJoker = signal<JokerDefinition | null>(null);
  readonly selectedBackImageUrl = signal('/cards/btf/deck.jpg');
  readonly selectedFaceImageTemplate = signal('/cards/btf/{rank}{suitShort}.jpg');
  readonly jokerCounters = signal<Record<string, number>>({});
  readonly handHistory = signal<Record<string, number>>({});
  readonly lastResult = signal<HandResult | null>(null);
  readonly resultFading = signal(false);
  readonly message = signal('Choose a Blind to begin the run.');
  readonly gameOver = signal(false);
  readonly won = signal(false);
  readonly pulse = signal(0);
  readonly isFullscreen = signal(false);
  readonly menuView = signal<'pause' | 'options' | 'collection' | null>(null);
  readonly crtEnabled = signal(true);
  readonly screenShakeEnabled = signal(true);
  readonly reducedMotion = signal(false);
  readonly gameSpeed = signal(1);
  readonly rerollCount = signal(0);
  readonly freeRerollUsed = signal(false);
  readonly isScoring = signal(false);
  readonly scoringCaption = signal('');
  readonly activeScoringCardId = signal<string | null>(null);
  readonly activeJokerInstanceId = signal<string | null>(null);
  readonly displayedChips = signal(0);
  readonly displayedMult = signal(0);
  readonly displayedXMult = signal(1);
  readonly displayedTotal = signal(0);
  readonly isChangingHand = signal(false);
  readonly discardingCardIds = signal<Set<string>>(new Set());
  readonly dealingCardIds = signal<Set<string>>(new Set());
  readonly playedCards = signal<PlayingCard[]>([]);
  readonly playedCardsFlying = signal(false);
  readonly deckViewOpen = signal(false);

  readonly selected = computed(() => this.hand().filter((card) => card.selected));
  readonly visibleJoker = computed(() => this.hoveredJoker() || this.selectedJoker());
  readonly visibleConsumable = computed(() => this.hoveredConsumable() || this.selectedConsumable());
  readonly selectedOwnedJoker = computed(() => {
    const selected = this.selectedJoker();
    return selected
      ? this.ownedJokers().find((joker) => joker.id === selected.id) || null
      : null;
  });
  readonly playedCardIds = computed(() => new Set(this.playedCards().map((card) => card.id)));
  readonly deckSuitRows = computed<DeckSuitRow[]>(() => {
    const remaining = new Map(this.deck().map((card) => [`${card.suit}-${card.rank}`, card]));
    return DECK_VIEW_SUITS.map(({ suit, label }) => ({
      suit,
      label,
      cards: [...RANKS]
        .reverse()
        .map((rank) => ({ rank, card: remaining.get(`${suit}-${rank}`) || null }))
    }));
  });
  readonly hasJoker = (id: string): boolean => this.ownedJokers().some((joker) => joker.id === id);
  readonly handSize = computed(() =>
    Math.max(
      3,
      8 +
        Number(this.hasJoker('juggler')) +
        Number(this.hasJoker('certificate')) -
        Number(this.hasJoker('merry-andy')) +
        (this.hasJoker('troubadour') ? 2 : 0) +
        (this.hasJoker('turtle-bean') ? Math.max(0, 5 - this.counter('turtle-bean')) : 0) -
        (this.hasJoker('stuntman') ? 2 : 0)
    )
  );
  readonly target = computed(() => {
    return this.blindTarget(this.blindIndex());
  });
  readonly progress = computed(() => Math.min(100, (this.score() / this.target()) * 100));
  readonly blindName = computed(() => BLIND_NAMES[this.blindIndex()]);
  readonly deckRemaining = computed(() => this.deck().length);
  readonly preview = computed(() => this.evaluate(this.selected(), false));
  readonly jokerSlotsLeft = computed(() => Math.max(0, 5 - this.ownedJokers().length));
  readonly emptyJokerSlots = computed(() => Array.from({ length: this.jokerSlotsLeft() }, (_, index) => index));
  readonly consumableSlotsLeft = computed(() => Math.max(0, 2 - this.consumables().length));
  readonly emptyConsumableSlots = computed(() =>
    Array.from({ length: this.consumableSlotsLeft() }, (_, index) => index)
  );
  readonly pendingBoost = computed(() => {
    const parts: string[] = [];
    if (this.nextHandChips()) parts.push(`+${this.nextHandChips()} Chips`);
    if (this.nextHandMult()) parts.push(`+${this.nextHandMult()} Mult`);
    if (this.nextHandXMult() > 1) parts.push(`×${this.formatMultiplier(this.nextHandXMult())}`);
    return parts.join(' · ');
  });
  readonly rerollCost = computed(() => {
    if (this.hasJoker('chaos') && !this.freeRerollUsed()) {
      return 0;
    }
    return Math.max(1, 5 + this.rerollCount() - (this.hasJoker('astronomer') ? 2 : 0));
  });
  readonly blindOptions = computed<BlindOption[]>(() =>
    BLIND_NAMES.map((name, index) => ({
      index,
      name,
      type: index === 0 ? 'small' : index === 1 ? 'big' : 'boss',
      target: this.blindTarget(index),
      reward: BLIND_REWARDS[index],
      status: index < this.blindIndex() ? 'cleared' : index === this.blindIndex() ? 'current' : 'locked',
      glyph: index === 2 ? '★' : String(index + 1),
      tag: index === 0 ? '+$3 Investment Tag' : index === 1 ? 'Free Shop Reroll' : 'Boss must be defeated'
    }))
  );

  constructor() {
    this.startRun();
    void this.syncSelectedDeck();
    effect(() => {
      const selectedDeckId = this.auth.currentUser()?.selectedCardDeckId || null;
      if (selectedDeckId && selectedDeckId !== this.loadedDeckId) {
        void this.syncSelectedDeck();
      }
    });
  }

  suitGlyph(suit: Suit): string {
    return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit];
  }

  isRed(suit: Suit): boolean {
    return suit === 'hearts' || suit === 'diamonds';
  }

  jokerArtUrl(joker: JokerDefinition): string {
    const assetIndex = (joker.artIndex % 125) + 1;
    return `/balatro/relics/item_${String(assetIndex).padStart(3, '0')}.png`;
  }

  cardFaceUrl(card: PlayingCard): string {
    return this.selectedFaceImageTemplate()
      .replaceAll('{rank}', card.rank)
      .replaceAll('{suit}', card.suit)
      .replaceAll('{suitShort}', this.suitShort(card.suit));
  }

  cardChipValue(card: PlayingCard): number {
    return RANK_VALUE[card.rank];
  }

  showJoker(joker: JokerDefinition): void {
    this.selectedConsumable.set(null);
    this.selectedJoker.set(this.selectedJoker()?.id === joker.id ? null : joker);
  }

  hoverJoker(joker: JokerDefinition | null): void {
    this.hoveredJoker.set(joker);
    if (joker) this.hoveredConsumable.set(null);
  }

  showConsumable(consumable: ConsumableDefinition): void {
    this.selectedJoker.set(null);
    this.selectedConsumable.set(this.selectedConsumable()?.id === consumable.id ? null : consumable);
  }

  hoverConsumable(consumable: ConsumableDefinition | null): void {
    this.hoveredConsumable.set(consumable);
    if (consumable) this.hoveredJoker.set(null);
  }

  consumableKindLabel(kind: ConsumableKind): string {
    return kind === 'glitch' ? 'GLITCH' : 'PROTOCOL';
  }

  consumableStatus(consumable: ConsumableDefinition): string {
    if (consumable.hand) {
      return `${consumable.hand} · LV.${this.handLevels()[consumable.hand]}`;
    }
    return consumable.id === 'cash-pulse' ? 'INSTANT' : 'NEXT HAND';
  }

  toggleDeckView(): void {
    if (this.phase() !== 'playing' || this.isScoring() || this.isChangingHand()) {
      return;
    }
    this.deckViewOpen.update((open) => !open);
  }

  cardsLeftInSuit(suit: Suit): number {
    return this.deck().filter((card) => card.suit === suit).length;
  }

  jokerStatus(joker: JokerDefinition): string | null {
    const hands = this.totalHandsPlayed();
    const counter = this.counter(joker.id);

    switch (joker.id) {
      case 'fortune-teller': return `+${counter} Mult`;
      case 'green-joker': return `+${counter} Mult`;
      case 'ice-cream': return `+${Math.max(0, 100 + counter)} Chips`;
      case 'popcorn': return `+${Math.max(0, 20 + counter)} Mult`;
      case 'red-card': return `+${counter} Mult`;
      case 'ride-the-bus': return `+${hands + 1} Mult`;
      case 'runner': return `+${counter} Chips`;
      case 'square': return `+${counter} Chips`;
      case 'supernova': return `${Object.values(this.handHistory()).reduce((sum, value) => sum + value, 0)} hands`;
      case 'castle': return `+${counter} Chips`;
      case 'ceremonial-dagger': return `+${counter} Mult`;
      case 'constellation': return `X${this.formatMultiplier(1 + counter)}`;
      case 'flash-card': return `+${counter} Mult`;
      case 'glass-joker': return `X${this.formatMultiplier(1 + counter)} · ${hands % 4}/4`;
      case 'hiker': return `+${counter} Chips`;
      case 'loyalty-card': {
        const progress = hands % 6;
        return progress === 5 ? 'X4 ready' : `${progress}/6 hands`;
      }
      case 'lucky-cat': return `X${this.formatMultiplier(1 + counter)}`;
      case 'madness': return `X${this.formatMultiplier(1 + counter)}`;
      case 'ramen': return `X${this.formatMultiplier(Math.max(1, 2 - counter * .01))}`;
      case 'spare-trousers': return `+${counter} Mult`;
      case 'steel-joker': return `X${this.formatMultiplier(1 + Math.floor(hands / 5) * .2)} · ${hands % 5}/5`;
      case 'throwback': return `X${this.formatMultiplier(1 + counter * .25)} · ${counter} skipped`;
      case 'turtle-bean': return `+${Math.max(0, 5 - counter)} hand size`;
      case 'vampire': return `X${this.formatMultiplier(1 + Math.floor(hands / 5) * .1)} · ${hands % 5}/5`;
      case 'campfire': return `X${this.formatMultiplier(1 + counter)}`;
      case 'drivers-license': return hands >= 16 ? 'X3 active' : `${hands}/16 hands`;
      case 'hit-the-road': return `X${this.formatMultiplier(1 + counter)}`;
      case 'obelisk': return `X${this.formatMultiplier(1 + Object.keys(this.handHistory()).length * .2)}`;
      case 'wee-joker': return `+${counter} Chips`;
      case 'canio': return `X${this.formatMultiplier(1 + counter)}`;
      case 'yorick': return `X${this.formatMultiplier(1 + counter)} · ${this.counter('yorick-cards') % 23}/23`;
      case 'egg': {
        const owned = this.ownedJokers().find((entry) => entry.id === joker.id);
        return owned ? `$${owned.sellValue} sell` : null;
      }
      default: return null;
    }
  }

  setFullscreen(value: boolean): void {
    this.isFullscreen.set(value);
    if (!value) {
      this.menuView.set(null);
    }
  }

  openMenu(): void {
    if (!this.gameOver()) {
      this.menuView.set('pause');
    }
  }

  resume(): void {
    this.menuView.set(null);
  }

  openOptions(): void {
    this.menuView.set('options');
  }

  setGameSpeed(value: string): void {
    this.gameSpeed.set(Number(value));
  }

  restartFromMenu(): void {
    this.startRun();
    this.menuView.set(null);
  }

  async returnToLobby(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    await this.router.navigateByUrl('/lobby');
  }

  startRun(): void {
    this.ante.set(1);
    this.blindIndex.set(0);
    this.money.set(4);
    this.score.set(0);
    this.handsLeft.set(4);
    this.discardsLeft.set(3);
    this.ownedJokers.set([]);
    this.shopOffers.set([]);
    this.consumables.set([]);
    this.consumableOffers.set([]);
    this.selectedConsumable.set(null);
    this.hoveredConsumable.set(null);
    this.handLevels.set({ ...INITIAL_HAND_LEVELS });
    this.nextHandChips.set(0);
    this.nextHandMult.set(0);
    this.nextHandXMult.set(1);
    this.selectedJoker.set(null);
    this.hoveredJoker.set(null);
    this.jokerCounters.set({});
    this.handHistory.set({});
    this.gameOver.set(false);
    this.won.set(false);
    this.lastResult.set(null);
    this.resultFading.set(false);
    this.playedCards.set([]);
    this.playedCardsFlying.set(false);
    this.deckViewOpen.set(false);
    this.activeScoringCardId.set(null);
    this.phase.set('blind-select');
    this.message.set('Choose a Blind to begin the run.');
    this.prepareDeck();
  }

  selectBlind(index: number): void {
    if (this.phase() !== 'blind-select' || index !== this.blindIndex()) {
      return;
    }

    let hands = 4;
    let discards = 3;
    if (this.hasJoker('drunkard')) discards += 1;
    if (this.hasJoker('burglar')) {
      hands += 3;
      discards = 0;
    }
    if (this.hasJoker('merry-andy')) discards += 3;

    this.handsLeft.set(hands);
    this.discardsLeft.set(discards);
    this.score.set(0);
    this.lastResult.set(null);
    this.resultFading.set(false);
    this.playedCards.set([]);
    this.playedCardsFlying.set(false);
    this.deckViewOpen.set(false);
    this.phase.set('playing');
    this.message.set(`${this.blindName()} selected. Score ${this.target().toLocaleString()} Chips.`);
    this.prepareDeck();
    this.applyBlindStartHooks();
  }

  skipBlind(index: number): void {
    if (this.phase() !== 'blind-select' || index !== this.blindIndex() || index === 2) {
      return;
    }

    this.addCounter('red-card', 3);
    this.addCounter('throwback', 1);
    if (index === 0) {
      this.money.update((value) => value + 3);
    } else {
      this.freeRerollUsed.set(false);
    }
    this.blindIndex.update((value) => value + 1);
    this.message.set(`${BLIND_NAMES[index]} skipped. Tag collected.`);
  }

  toggleCard(id: string): void {
    if (this.phase() !== 'playing' || this.gameOver() || this.isChangingHand()) {
      return;
    }

    this.hand.update((cards) => {
      const card = cards.find((candidate) => candidate.id === id);
      if (!card || (!card.selected && this.selected().length >= 5)) {
        return cards;
      }
      return cards.map((candidate) => candidate.id === id ? { ...candidate, selected: !candidate.selected } : candidate);
    });
    this.lastResult.set(null);
    this.resultFading.set(false);
  }

  async playHand(): Promise<void> {
    const cards = this.selected();
    if (
      !cards.length ||
      this.handsLeft() <= 0 ||
      this.phase() !== 'playing' ||
      this.gameOver() ||
      this.isScoring() ||
      this.isChangingHand()
    ) {
      return;
    }

    const result = this.evaluate(cards, true);
    this.playedCards.set(cards.map((card) => ({ ...card })));
    this.resultFading.set(false);
    this.lastResult.set(result);
    await this.animateScoring(result, cards);
    this.nextHandChips.set(0);
    this.nextHandMult.set(0);
    this.nextHandXMult.set(1);

    this.score.update((value) => value + result.score);
    this.money.update((value) => value + result.money);
    this.handsLeft.update((value) => value - 1);
    this.pulse.update((value) => value + 1);
    this.handHistory.update((history) => ({ ...history, [result.name]: (history[result.name] || 0) + 1 }));
    this.updateHandCounters(result, cards);
    this.message.set(`${result.name}! ${result.chips} Chips × ${result.mult}${result.xMult > 1 ? ` ×${result.xMult.toFixed(2)}` : ''}`);
    await this.animatePlayedCardsToDeck();
    await this.replaceSelected(false);
    this.scoringCaption.set('');
    await this.dismissScoreResult();
    this.isScoring.set(false);

    if (this.score() >= this.target()) {
      await this.delay(250);
      this.completeBlind();
    } else if (this.handsLeft() === 0) {
      if (this.hasJoker('mr-bones') && this.score() >= this.target() * 0.25) {
        this.sellJoker(this.ownedJokers().find((joker) => joker.id === 'mr-bones')!.instanceId, false);
        this.completeBlind();
      } else {
        this.gameOver.set(true);
        this.message.set('The Blind survived. Rebuild the deck and run it back.');
      }
    }
  }

  async discard(): Promise<void> {
    const cards = this.selected();
    if (
      !cards.length ||
      this.discardsLeft() <= 0 ||
      this.phase() !== 'playing' ||
      this.gameOver() ||
      this.isScoring() ||
      this.isChangingHand()
    ) {
      return;
    }

    if (this.hasJoker('faceless') && cards.filter((card) => this.isFace(card)).length >= 3) {
      this.money.update((value) => value + 5);
    }
    if (this.hasJoker('mail-in-rebate')) {
      this.money.update((value) => value + cards.filter((card) => card.rank === '5').length * 5);
    }
    if (this.hasJoker('castle')) {
      this.addCounter('castle', cards.filter((card) => card.suit === 'spades').length * 3);
    }
    if (this.hasJoker('ramen')) this.addCounter('ramen', cards.length);
    if (this.hasJoker('hit-the-road')) this.addCounter('hit-the-road', cards.filter((card) => card.rank === 'J').length * 0.5);
    if (this.hasJoker('canio')) this.addCounter('canio', cards.filter((card) => this.isFace(card)).length * 0.2);
    if (this.hasJoker('yorick')) this.addCounter('yorick-cards', cards.length);
    if (this.hasJoker('yorick')) this.jokerCounters.update((counters) => ({
      ...counters,
      yorick: Math.floor((counters['yorick-cards'] || 0) / 23)
    }));
    if (this.hasJoker('trading-card') && this.discardsLeft() === this.initialDiscards() && cards.length === 1) {
      this.money.update((value) => value + 3);
    }
    if (this.hasJoker('green-joker')) {
      this.addCounter('green-joker', -1, 0);
    }

    this.discardsLeft.update((value) => value - 1);
    this.lastResult.set(null);
    this.resultFading.set(false);
    this.message.set('Discarding...');
    await this.replaceSelected();
    this.message.set('Fresh cards. Find the line.');
  }

  buyJoker(joker: JokerDefinition): void {
    if (this.phase() !== 'shop' || this.ownedJokers().length >= 5 || !this.canAfford(joker.cost)) {
      return;
    }

    this.money.update((value) => value - joker.cost);
    this.ownedJokers.update((owned) => [
      ...owned,
      { ...joker, instanceId: `${joker.id}-${Date.now()}-${owned.length}`, sellValue: Math.max(1, Math.floor(joker.cost / 2)) }
    ]);
    this.shopOffers.update((offers) => offers.filter((offer) => offer.id !== joker.id));
    if (this.hasJoker('hallucination') && Math.random() < 0.5) {
      this.money.update((value) => value + 2);
    }
  }

  canBuyJoker(joker: JokerDefinition): boolean {
    return this.phase() === 'shop' && this.ownedJokers().length < 5 && this.canAfford(joker.cost);
  }

  buyConsumable(consumable: ConsumableDefinition): void {
    if (
      this.phase() !== 'shop' ||
      this.consumables().length >= 2 ||
      !this.canAfford(consumable.cost)
    ) {
      return;
    }

    this.money.update((value) => value - consumable.cost);
    this.consumables.update((owned) => [
      ...owned,
      { ...consumable, instanceId: `${consumable.id}-${Date.now()}-${owned.length}` }
    ]);
    this.consumableOffers.update((offers) => offers.filter((offer) => offer.id !== consumable.id));
    this.message.set(`${consumable.name} stored. Use it when the timing is right.`);
  }

  canBuyConsumable(consumable: ConsumableDefinition): boolean {
    return this.phase() === 'shop' && this.consumables().length < 2 && this.canAfford(consumable.cost);
  }

  useConsumable(consumable: OwnedConsumable): void {
    if (this.isScoring() || this.isChangingHand() || this.gameOver()) {
      return;
    }

    if (consumable.money) this.money.update((value) => value + consumable.money!);
    if (consumable.nextChips) this.nextHandChips.update((value) => value + consumable.nextChips!);
    if (consumable.nextMult) this.nextHandMult.update((value) => value + consumable.nextMult!);
    if (consumable.nextXMult) this.nextHandXMult.update((value) => value * consumable.nextXMult!);
    if (consumable.hand) {
      this.handLevels.update((levels) => ({
        ...levels,
        [consumable.hand!]: levels[consumable.hand!] + 1
      }));
    }

    this.consumables.update((owned) => owned.filter((entry) => entry.instanceId !== consumable.instanceId));
    if (this.selectedConsumable()?.id === consumable.id) this.selectedConsumable.set(null);
    this.message.set(
      consumable.hand
        ? `${consumable.hand} upgraded to level ${this.handLevels()[consumable.hand]}.`
        : `${consumable.name} activated${this.pendingBoost() ? `: ${this.pendingBoost()}.` : '.'}`
    );
  }

  sellJoker(instanceId: string, grantMoney = true): void {
    const joker = this.ownedJokers().find((entry) => entry.instanceId === instanceId);
    if (!joker) {
      return;
    }

    if (grantMoney) {
      this.money.update((value) => value + (joker.id === 'diet-cola' ? 8 : joker.sellValue));
      if (this.hasJoker('ceremonial-dagger') && joker.id !== 'ceremonial-dagger') {
        this.addCounter('ceremonial-dagger', joker.sellValue * 2);
      }
      if (this.hasJoker('campfire') && joker.id !== 'campfire') {
        this.addCounter('campfire', 0.25);
      }
    }
    this.ownedJokers.update((owned) => owned.filter((entry) => entry.instanceId !== instanceId));
    if (this.selectedJoker()?.id === joker.id) {
      this.selectedJoker.set(null);
    }
  }

  rerollShop(): void {
    const cost = this.rerollCost();
    if (this.phase() !== 'shop' || !this.canAfford(cost)) {
      return;
    }
    this.money.update((value) => value - cost);
    if (cost === 0) {
      this.freeRerollUsed.set(true);
    }
    this.rerollCount.update((value) => value + 1);
    this.addCounter('flash-card', 2);
    this.generateShop();
  }

  leaveShop(): void {
    if (this.phase() !== 'shop') {
      return;
    }

    if (this.hasJoker('perkeo')) this.money.update((value) => value + 5);

    if (this.blindIndex() === 2) {
      if (this.ante() === MAX_ANTE) {
        this.phase.set('playing');
        this.selectedJoker.set(null);
        this.selectedConsumable.set(null);
        this.gameOver.set(true);
        this.won.set(true);
        this.message.set(`Ante ${MAX_ANTE} cleared. The deck belongs to you.`);
        return;
      }
      this.ante.update((value) => value + 1);
      this.blindIndex.set(0);
    } else {
      this.blindIndex.update((value) => value + 1);
    }

    this.phase.set('blind-select');
    this.score.set(0);
    this.lastResult.set(null);
    this.resultFading.set(false);
    this.message.set('Choose the next Blind.');
  }

  private completeBlind(): void {
    const reward = BLIND_REWARDS[this.blindIndex()] + this.handsLeft();
    let bonus = 0;
    if (this.hasJoker('golden-joker')) bonus += 4;
    if (this.hasJoker('delayed-gratification') && this.discardsLeft() === 3) bonus += this.discardsLeft() * 2;
    if (this.hasJoker('cloud-9')) bonus += this.buildDeck().filter((card) => card.rank === '9').length;
    if (this.blindIndex() === 2 && this.hasJoker('matador')) bonus += 8;
    if (this.hasJoker('rocket')) bonus += 1 + (this.blindIndex() === 2 ? 2 : 0);
    if (this.hasJoker('satellite')) bonus += Object.keys(this.handHistory()).length;
    if (this.hasJoker('to-the-moon')) bonus += Math.floor(Math.max(0, this.money()) / 5);

    this.money.update((value) => value + reward + bonus);
    this.ownedJokers.update((owned) => owned.map((joker) => ({
      ...joker,
      sellValue: joker.sellValue + (joker.id === 'egg' ? 3 : joker.id === 'gift-card' ? 1 : 0)
    })));
    this.addCounter('popcorn', -4, -20);
    this.addCounter('turtle-bean', 1);
    if (this.blindIndex() === 2) this.jokerCounters.update((counters) => ({ ...counters, campfire: 0 }));
    this.rerollCount.set(0);
    this.freeRerollUsed.set(false);

    if (this.blindIndex() === 2 && this.ante() === MAX_ANTE) {
      this.phase.set('playing');
      this.selectedJoker.set(null);
      this.selectedConsumable.set(null);
      this.hoveredJoker.set(null);
      this.hoveredConsumable.set(null);
      this.gameOver.set(true);
      this.won.set(true);
      this.message.set(`Ante ${MAX_ANTE} cleared. The deck belongs to you.`);
      return;
    }

    this.phase.set('shop');
    this.generateShop();
    this.message.set(`Blind defeated. Earned $${reward + bonus}.`);
  }

  private async animateScoring(result: HandResult, cards: PlayingCard[]): Promise<void> {
    this.isScoring.set(true);
    this.displayedChips.set(this.baseHandChips(result.name));
    this.displayedMult.set(result.mult > 0 ? Math.min(result.mult, this.baseHandMult(result.name)) : 1);
    this.displayedXMult.set(1);
    this.displayedTotal.set(0);
    this.scoringCaption.set(result.name);
    await this.delay(260);

    const scoringCards = cards.filter((card) => result.scoringIds.has(card.id));
    for (const card of scoringCards) {
      this.activeScoringCardId.set(card.id);
      this.scoringCaption.set(`${card.rank}${this.suitGlyph(card.suit)} scores`);
      this.displayedChips.update((value) => value + RANK_VALUE[card.rank]);
      await this.delay(300);
      this.activeScoringCardId.set(null);
      await this.delay(70);
    }

    const baseChips = this.displayedChips();
    const jokerCount = Math.max(1, this.ownedJokers().length);
    const chipStep = (result.chips - baseChips) / jokerCount;
    const startingMult = this.displayedMult();
    const multStep = (result.mult - startingMult) / jokerCount;
    const xStep = (result.xMult - 1) / jokerCount;

    if (!this.ownedJokers().length) {
      this.displayedChips.set(result.chips);
      this.displayedMult.set(result.mult);
      this.displayedXMult.set(result.xMult);
      await this.delay(220);
    } else {
      for (let index = 0; index < this.ownedJokers().length; index += 1) {
        const joker = this.ownedJokers()[index];
        this.activeJokerInstanceId.set(joker.instanceId);
        this.scoringCaption.set(joker.name);
        this.displayedChips.set(Math.round(baseChips + chipStep * (index + 1)));
        this.displayedMult.set(Math.max(1, Math.round(startingMult + multStep * (index + 1))));
        this.displayedXMult.set(1 + xStep * (index + 1));
        await this.delay(260);
        this.activeJokerInstanceId.set(null);
        await this.delay(60);
      }
    }
    this.activeJokerInstanceId.set(null);

    this.displayedChips.set(result.chips);
    this.displayedMult.set(result.mult);
    this.displayedXMult.set(result.xMult);
    this.scoringCaption.set('Total score');

    const frames = 10;
    for (let frame = 1; frame <= frames; frame += 1) {
      const eased = 1 - Math.pow(1 - frame / frames, 3);
      this.displayedTotal.set(Math.round(result.score * eased));
      await this.delay(42);
    }
    this.displayedTotal.set(result.score);
    await this.delay(280);
  }

  private async syncSelectedDeck(): Promise<void> {
    try {
      const selectedDeckId = this.auth.currentUser()?.selectedCardDeckId || null;
      const decks = await this.cardDeckService.listMine();
      const selected = decks.find((deck) => deck.selected) || decks.find((deck) => deck.id === selectedDeckId) || null;

      if (!selected) {
        this.selectedBackImageUrl.set('/cards/btf/deck.jpg');
        this.selectedFaceImageTemplate.set('/cards/btf/{rank}{suitShort}.jpg');
        this.loadedDeckId = null;
        return;
      }

      this.selectedBackImageUrl.set(selected.backImageUrl);
      this.selectedFaceImageTemplate.set(selected.faceImageTemplate);
      this.loadedDeckId = selected.id;
    } catch {
      this.selectedBackImageUrl.set('/cards/btf/deck.jpg');
      this.selectedFaceImageTemplate.set('/cards/btf/{rank}{suitShort}.jpg');
      this.loadedDeckId = null;
    }
  }

  private suitShort(suit: Suit): string {
    return { hearts: 'H', diamonds: 'D', clubs: 'C', spades: 'S' }[suit];
  }

  private async animatePlayedCardsToDeck(): Promise<void> {
    this.activeScoringCardId.set(null);
    this.scoringCaption.set('Cards scored');
    this.playedCardsFlying.set(true);
    await this.delay(520 + this.playedCards().length * 45);
    this.playedCards.set([]);
    this.playedCardsFlying.set(false);
  }

  private async dismissScoreResult(): Promise<void> {
    await this.delay(420);
    this.resultFading.set(true);
    await this.delay(220);
    this.lastResult.set(null);
    this.resultFading.set(false);
  }

  private applyBlindStartHooks(): void {
    if (this.hasJoker('cartomancer')) this.money.update((value) => value + 3);
    if (this.hasJoker('marble')) this.addCounter('marble', 25);
    if (this.hasJoker('madness') && this.blindIndex() < 2) this.addCounter('madness', 0.5);
    if (this.hasJoker('riff-raff') && this.ownedJokers().length < 5) {
      const candidates = BALATRO_JOKERS.filter((joker) =>
        joker.rarity === 'common' && !this.ownedJokers().some((owned) => owned.id === joker.id)
      );
      const created = candidates[Math.floor(Math.random() * candidates.length)];
      if (created) {
        this.ownedJokers.update((owned) => [
          ...owned,
          { ...created, instanceId: `${created.id}-${Date.now()}`, sellValue: 0 }
        ]);
      }
    }
  }

  private updateHandCounters(result: HandResult, cards: PlayingCard[]): void {
    if (this.hasJoker('fortune-teller')) this.addCounter('fortune-teller', 1);
    if (this.hasJoker('green-joker')) this.addCounter('green-joker', 1);
    if (this.hasJoker('ice-cream')) this.addCounter('ice-cream', -5, -100);
    if (this.hasJoker('runner') && result.name === 'Straight') this.addCounter('runner', 15);
    if (this.hasJoker('square') && cards.length === 4) this.addCounter('square', 4);
    if (this.hasJoker('constellation')) this.addCounter('constellation', 0.1);
    if (this.hasJoker('hiker')) this.addCounter('hiker', result.scoringIds.size * 5);
    if (this.hasJoker('glass-joker') && this.totalHandsPlayed() % 4 === 3) this.addCounter('glass-joker', 0.5);
    if (this.hasJoker('lucky-cat') && Math.random() < 0.25) this.addCounter('lucky-cat', 0.25);
    if (this.hasJoker('spare-trousers') && result.name === 'Two Pair') this.addCounter('spare-trousers', 2);
    if (this.hasJoker('wee-joker')) this.addCounter('wee-joker', cards.filter((card) => card.rank === '2').length * 8);
  }

  private evaluate(cards: PlayingCard[], resolveRandom: boolean): HandResult {
    if (!cards.length) {
      return { name: 'Choose cards', chips: 0, mult: 0, xMult: 1, score: 0, money: 0, scoringIds: new Set() };
    }

    const counts = new Map<Rank, number>();
    cards.forEach((card) => counts.set(card.rank, (counts.get(card.rank) || 0) + 1));
    const groups = [...counts.entries()].sort((left, right) => right[1] - left[1] || POKER_VALUE[right[0]] - POKER_VALUE[left[0]]);
    const straightLength = this.hasJoker('four-fingers') ? 4 : 5;
    const flushLength = this.hasJoker('four-fingers') ? 4 : 5;
    const flush = cards.length >= flushLength && SUITS.some((suit) => cards.filter((card) => card.suit === suit).length >= flushLength);
    const uniqueValues = [...new Set(cards.map((card) => POKER_VALUE[card.rank]))].sort((a, b) => a - b);
    const wheel = uniqueValues.includes(14) && [2, 3, 4, 5].every((value) => uniqueValues.includes(value));
    const straight = uniqueValues.length >= straightLength &&
      (wheel || uniqueValues.some((value, index) => index <= uniqueValues.length - straightLength &&
        uniqueValues[index + straightLength - 1] - value === straightLength - 1));

    let name: HandName = 'High Card';
    let baseChips = 5;
    let mult = 1;
    let scoring = [cards.reduce((best, card) => POKER_VALUE[card.rank] > POKER_VALUE[best.rank] ? card : best)];

    if (straight && flush) {
      name = 'Straight Flush'; baseChips = 100; mult = 8; scoring = cards;
    } else if (groups[0][1] === 4) {
      name = 'Four of a Kind'; baseChips = 60; mult = 7;
      scoring = cards.filter((card) => card.rank === groups[0][0]);
    } else if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
      name = 'Full House'; baseChips = 40; mult = 4; scoring = cards;
    } else if (flush) {
      name = 'Flush'; baseChips = 35; mult = 4; scoring = cards;
    } else if (straight) {
      name = 'Straight'; baseChips = 30; mult = 4; scoring = cards;
    } else if (groups[0][1] === 3) {
      name = 'Three of a Kind'; baseChips = 30; mult = 3;
      scoring = cards.filter((card) => card.rank === groups[0][0]);
    } else if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
      name = 'Two Pair'; baseChips = 20; mult = 2;
      scoring = cards.filter((card) => groups.slice(0, 2).some(([rank]) => rank === card.rank));
    } else if (groups[0][1] === 2) {
      name = 'Pair'; baseChips = 10; mult = 2;
      scoring = cards.filter((card) => card.rank === groups[0][0]);
    }

    const handLevel = this.handLevels()[name] || 1;
    const levelGrowth = HAND_LEVEL_GROWTH[name];
    baseChips = HAND_BASE_CHIPS[name] + (handLevel - 1) * levelGrowth.chips;
    mult = HAND_BASE_MULT[name] + (handLevel - 1) * levelGrowth.mult;

    if (this.hasJoker('splash')) {
      scoring = cards;
    }

    let chips = baseChips + scoring.reduce((sum, card) => sum + RANK_VALUE[card.rank], 0);
    let xMult = 1;
    let money = 0;
    const faceCards = scoring.filter((card) => this.isFace(card));
    const heldCards = this.hand().filter((card) => !cards.some((played) => played.id === card.id));
    const ids = new Set(this.ownedJokers().map((joker) => joker.id));
    const hasHand = (hand: HandName): boolean => name === hand || (hand === 'Pair' && ['Two Pair', 'Full House', 'Four of a Kind'].includes(name));

    for (const joker of this.ownedJokers()) {
      switch (joker.id) {
        case 'abstract': mult += this.ownedJokers().length * 3; break;
        case 'banner': chips += this.discardsLeft() * 30; break;
        case 'blue-joker': chips += this.deck().length * 2; break;
        case 'cavendish': xMult *= 3; break;
        case 'clever': if (hasHand('Two Pair')) chips += 80; break;
        case 'crafty': if (hasHand('Flush')) chips += 80; break;
        case 'crazy': if (hasHand('Straight')) mult += 12; break;
        case 'devious': if (hasHand('Straight')) chips += 100; break;
        case 'droll': if (hasHand('Flush')) mult += 10; break;
        case 'even-steven': mult += scoring.filter((card) => POKER_VALUE[card.rank] % 2 === 0).length * 4; break;
        case 'fortune-teller': mult += this.counter('fortune-teller'); break;
        case 'gluttonous': mult += scoring.filter((card) => card.suit === 'clubs').length * 3; break;
        case 'greedy': mult += scoring.filter((card) => card.suit === 'diamonds').length * 3; break;
        case 'green-joker': mult += this.counter('green-joker'); break;
        case 'gros-michel': mult += 15; break;
        case 'half-joker': if (cards.length <= 3) mult += 20; break;
        case 'hanging-chad': chips += scoring.length ? RANK_VALUE[scoring[0].rank] * 2 : 0; break;
        case 'ice-cream': chips += Math.max(0, 100 + this.counter('ice-cream')); break;
        case 'joker': mult += 4; break;
        case 'jolly': if (hasHand('Pair')) mult += 8; break;
        case 'lusty': mult += scoring.filter((card) => card.suit === 'hearts').length * 3; break;
        case 'mad': if (hasHand('Two Pair')) mult += 10; break;
        case 'misprint': mult += resolveRandom ? Math.floor(Math.random() * 24) : 11; break;
        case 'mystic-summit': if (this.discardsLeft() === 0) mult += 15; break;
        case 'odd-todd': chips += scoring.filter((card) => POKER_VALUE[card.rank] % 2 === 1).length * 31; break;
        case 'photograph': if (faceCards.length) xMult *= 2; break;
        case 'popcorn': mult += Math.max(0, 20 + this.counter('popcorn')); break;
        case 'raised-fist': {
          const lowest = heldCards.reduce((value, card) => Math.min(value, POKER_VALUE[card.rank]), 14);
          if (lowest < 14) mult += lowest * 2;
          break;
        }
        case 'red-card': mult += this.counter('red-card'); break;
        case 'ride-the-bus': if (!faceCards.length) mult += this.totalHandsPlayed() + 1; break;
        case 'runner': chips += this.counter('runner'); break;
        case 'scary-face': chips += faceCards.length * 30; break;
        case 'scholar': {
          const aces = scoring.filter((card) => card.rank === 'A').length;
          chips += aces * 20; mult += aces * 4; break;
        }
        case 'shoot-the-moon': mult += heldCards.filter((card) => card.rank === 'Q').length * 13; break;
        case 'sly': if (hasHand('Pair')) chips += 50; break;
        case 'smiley-face': mult += faceCards.length * 5; break;
        case 'square': chips += this.counter('square'); break;
        case 'supernova': mult += this.handHistory()[name] || 0; break;
        case 'swashbuckler': mult += this.ownedJokers().filter((entry) => entry.instanceId !== joker.instanceId).reduce((sum, entry) => sum + entry.sellValue, 0); break;
        case 'walkie-talkie': {
          const matching = scoring.filter((card) => card.rank === '10' || card.rank === '4').length;
          chips += matching * 10; mult += matching * 4; break;
        }
        case 'wily': if (hasHand('Three of a Kind')) chips += 100; break;
        case 'wrathful': mult += scoring.filter((card) => card.suit === 'spades').length * 3; break;
        case 'zany': if (hasHand('Three of a Kind')) mult += 12; break;
        case 'acrobat': if (this.handsLeft() === 1) xMult *= 3; break;
        case 'arrowhead': chips += scoring.filter((card) => card.suit === 'spades').length * 50; break;
        case 'blackboard': if (heldCards.length && heldCards.every((card) => card.suit === 'clubs' || card.suit === 'spades')) xMult *= 3; break;
        case 'bloodstone': if (scoring.some((card) => card.suit === 'hearts') && (!resolveRandom || Math.random() < 0.5)) xMult *= 1.5; break;
        case 'bootstraps': mult += Math.floor(Math.max(0, this.money()) / 5) * 2; break;
        case 'bull': chips += Math.max(0, this.money()) * 2; break;
        case 'card-sharp': if ((this.handHistory()[name] || 0) > 0) xMult *= 3; break;
        case 'castle': chips += this.counter('castle'); break;
        case 'ceremonial-dagger': mult += this.counter('ceremonial-dagger'); break;
        case 'constellation': xMult *= 1 + this.counter('constellation'); break;
        case 'dusk': if (this.handsLeft() === 1) chips += scoring.reduce((sum, card) => sum + RANK_VALUE[card.rank], 0); break;
        case 'erosion': mult += Math.max(0, 52 - this.buildDeck().length) * 4; break;
        case 'fibonacci': mult += scoring.filter((card) => ['A', '2', '3', '5', '8'].includes(card.rank)).length * 8; break;
        case 'flash-card': mult += this.counter('flash-card'); break;
        case 'flower-pot': if (new Set(scoring.map((card) => card.suit)).size === 4) xMult *= 3; break;
        case 'glass-joker': xMult *= 1 + this.counter('glass-joker'); break;
        case 'hack': {
          const retriggers = scoring.filter((card) => ['2', '3', '4', '5'].includes(card.rank));
          chips += retriggers.reduce((sum, card) => sum + RANK_VALUE[card.rank], 0); break;
        }
        case 'hiker': chips += this.counter('hiker'); break;
        case 'joker-stencil': xMult *= Math.max(1, 5 - this.ownedJokers().length + 1); break;
        case 'loyalty-card': if ((this.totalHandsPlayed() + 1) % 6 === 0) xMult *= 4; break;
        case 'lucky-cat': xMult *= 1 + this.counter('lucky-cat'); break;
        case 'madness': xMult *= 1 + this.counter('madness'); break;
        case 'marble': chips += this.counter('marble'); break;
        case 'midas-mask': money += faceCards.length; break;
        case 'mime': mult += heldCards.filter((card) => card.rank === 'Q').length * 13; break;
        case 'onyx-agate': mult += scoring.filter((card) => card.suit === 'clubs').length * 7; break;
        case 'ramen': xMult *= Math.max(1, 2 - this.counter('ramen') * 0.01); break;
        case 'rough-gem': money += scoring.filter((card) => card.suit === 'diamonds').length; break;
        case 'seeing-double': if (scoring.some((card) => card.suit === 'clubs') && scoring.some((card) => card.suit !== 'clubs')) xMult *= 2; break;
        case 'seltzer': if (this.totalHandsPlayed() < 10) chips += scoring.reduce((sum, card) => sum + RANK_VALUE[card.rank], 0); break;
        case 'sock-and-buskin': chips += faceCards.reduce((sum, card) => sum + RANK_VALUE[card.rank], 0); break;
        case 'spare-trousers': mult += this.counter('spare-trousers'); break;
        case 'steel-joker': xMult *= 1 + Math.floor(this.totalHandsPlayed() / 5) * 0.2; break;
        case 'stone-joker': chips += Math.max(0, this.ante() - 1) * 25; break;
        case 'the-idol': xMult *= Math.pow(2, scoring.filter((card) => card.rank === '7').length); break;
        case 'throwback': xMult *= 1 + this.counter('throwback') * 0.25; break;
        case 'vampire': xMult *= 1 + Math.floor(this.totalHandsPlayed() / 5) * 0.1; break;
        case 'ancient-joker': xMult *= Math.pow(1.5, scoring.filter((card) => card.suit === SUITS[this.ante() % 4]).length); break;
        case 'baron': xMult *= Math.pow(1.5, heldCards.filter((card) => card.rank === 'K').length); break;
        case 'baseball-card': xMult *= Math.pow(1.5, this.ownedJokers().filter((entry) => entry.rarity === 'uncommon').length); break;
        case 'blueprint': xMult *= 1.5; break;
        case 'brainstorm': xMult *= 1.5; break;
        case 'campfire': xMult *= 1 + this.counter('campfire'); break;
        case 'dna': if (this.totalHandsPlayed() === 0 && cards.length === 1) chips += 50; break;
        case 'drivers-license': if (this.totalHandsPlayed() >= 16) xMult *= 3; break;
        case 'hit-the-road': xMult *= 1 + this.counter('hit-the-road'); break;
        case 'obelisk': xMult *= 1 + Object.keys(this.handHistory()).length * 0.2; break;
        case 'stuntman': chips += 250; break;
        case 'the-duo': if (hasHand('Pair')) xMult *= 2; break;
        case 'the-family': if (name === 'Four of a Kind') xMult *= 4; break;
        case 'the-order': if (hasHand('Straight')) xMult *= 3; break;
        case 'the-tribe': if (hasHand('Flush')) xMult *= 2; break;
        case 'the-trio': if (hasHand('Three of a Kind')) xMult *= 3; break;
        case 'vagabond': if (this.money() <= 4) money += 3; break;
        case 'wee-joker': chips += this.counter('wee-joker'); break;
        case 'canio': xMult *= 1 + this.counter('canio'); break;
        case 'triboulet': xMult *= Math.pow(2, scoring.filter((card) => card.rank === 'K' || card.rank === 'Q').length); break;
        case 'yorick': xMult *= 1 + this.counter('yorick'); break;
        case 'business-card': if (resolveRandom) money += faceCards.filter(() => Math.random() < 0.5).length * 2; break;
        case 'golden-ticket': if (resolveRandom) money += faceCards.filter(() => Math.random() < 0.25).length * 4; break;
        case 'reserved-parking': if (resolveRandom) money += heldCards.filter((card) => this.isFace(card) && Math.random() < 0.5).length; break;
        case '8-ball': if (resolveRandom) money += scoring.filter((card) => card.rank === '8' && Math.random() < 0.25).length * 2; break;
      }
    }

    if (ids.has('to-do-list') && name === 'Pair') money += 4;
    if (ids.has('superposition') && straight && cards.some((card) => card.rank === 'A')) money += 4;
    chips += this.nextHandChips();
    mult += this.nextHandMult();
    xMult *= this.nextHandXMult();

    return {
      name,
      chips: Math.max(0, Math.round(chips)),
      mult: Math.max(1, Math.round(mult)),
      xMult,
      score: Math.max(0, Math.round(chips * mult * xMult)),
      money,
      scoringIds: new Set(scoring.map((card) => card.id))
    };
  }

  private generateShop(): void {
    const ownedIds = new Set(this.ownedJokers().map((joker) => joker.id));
    const available = BALATRO_JOKERS.filter((joker) => !ownedIds.has(joker.id));
    const weighted = available.filter((joker) => joker.rarity === 'common' || Math.random() < 0.45);
    this.shopOffers.set(this.shuffle(weighted).slice(0, 3));
    this.consumableOffers.set(this.shuffle(CONSUMABLES).slice(0, 3));
  }

  private canAfford(cost: number): boolean {
    const creditLimit = this.hasJoker('credit-card') ? -20 : 0;
    return this.money() - cost >= creditLimit;
  }

  private blindTarget(blindIndex: number): number {
    const anteBase = ANTE_BASE_TARGETS[Math.min(MAX_ANTE, Math.max(1, this.ante())) - 1];
    const bossModifier = blindIndex === 2 && this.hasJoker('luchador') ? .75 : 1;
    return Math.round(anteBase * BLIND_TARGET_MULTIPLIERS[blindIndex] * bossModifier);
  }

  private prepareDeck(): void {
    const deck = this.shuffle(this.buildDeck());
    this.hand.set(this.sortHand(deck.splice(0, this.handSize())));
    this.deck.set(deck);
  }

  private async replaceSelected(animateRemoval = true): Promise<void> {
    const selectedIds = new Set(this.selected().map((card) => card.id));
    if (!selectedIds.size) {
      return;
    }

    this.isChangingHand.set(true);
    if (animateRemoval) {
      this.discardingCardIds.set(selectedIds);
      await this.delay(300);
    }

    const kept = this.sortHand(
      this.hand()
        .filter((card) => !selectedIds.has(card.id))
        .map((card) => ({ ...card, selected: false }))
    );
    const deck = [...this.deck()];
    const dealt: PlayingCard[] = [];
    this.hand.set(kept);
    this.discardingCardIds.set(new Set());

    while (kept.length + dealt.length < this.handSize()) {
      if (!deck.length) {
        const heldIds = new Set([...kept, ...dealt].map((card) => card.id));
        deck.push(...this.shuffle(this.buildDeck().filter((card) => !heldIds.has(card.id))));
      }

      const nextCard = deck.shift();
      if (!nextCard) {
        break;
      }

      dealt.push({ ...nextCard, selected: false });
      this.dealingCardIds.set(new Set(dealt.map((card) => card.id)));
      this.hand.set(this.sortHand([...kept, ...dealt]));
      await this.delay(110);
    }

    this.deck.set(deck);
    await this.delay(430);
    this.dealingCardIds.set(new Set());
    this.isChangingHand.set(false);
  }

  private sortHand(cards: PlayingCard[]): PlayingCard[] {
    return [...cards].sort((left, right) =>
      POKER_VALUE[right.rank] - POKER_VALUE[left.rank] ||
      SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit)
    );
  }

  private counter(id: string): number {
    return this.jokerCounters()[id] || 0;
  }

  private formatMultiplier(value: number): string {
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  private baseHandMult(name: HandResult['name']): number {
    if (name === 'Choose cards') return 1;
    const level = this.handLevels()[name] || 1;
    return HAND_BASE_MULT[name] + (level - 1) * HAND_LEVEL_GROWTH[name].mult;
  }

  private baseHandChips(name: HandResult['name']): number {
    if (name === 'Choose cards') return 0;
    const level = this.handLevels()[name] || 1;
    return HAND_BASE_CHIPS[name] + (level - 1) * HAND_LEVEL_GROWTH[name].chips;
  }

  private addCounter(id: string, amount: number, minimum = 0): void {
    this.jokerCounters.update((counters) => ({
      ...counters,
      [id]: Math.max(minimum, (counters[id] || 0) + amount)
    }));
  }

  private totalHandsPlayed(): number {
    return Object.values(this.handHistory()).reduce((sum, value) => sum + value, 0);
  }

  private isFace(card: PlayingCard): boolean {
    return this.hasJoker('pareidolia') || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  }

  private initialDiscards(): number {
    if (this.hasJoker('burglar')) return 0;
    return 3 + Number(this.hasJoker('drunkard')) + (this.hasJoker('merry-andy') ? 3 : 0);
  }

  private buildDeck(): PlayingCard[] {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({
      id: `${rank}-${suit}`,
      rank,
      suit,
      selected: false
    })));
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds / this.gameSpeed()));
  }
}
