#include <algorithm>
#include <array>
#include <cctype>
#include <iostream>
#include <optional>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

using namespace std;

enum class Suit {
    Spades,
    Hearts,
    Diamonds,
    Clubs,
    None
};

struct Card {
    string rank;
    Suit suit = Suit::None;
    bool joker = false;

    static Card jokerCard() {
        Card card;
        card.rank = "JK";
        card.joker = true;
        return card;
    }

    static Card normal(string rankValue, Suit suitValue) {
        Card card;
        card.rank = rankValue;
        card.suit = suitValue;
        return card;
    }

    string toString() const;
};

struct Deck {
    vector<Card> cards;

    static Deck standard500Deck();
    void shuffle();
    Card draw();
};

struct Hand {
    vector<Card> cards;

    void add(Card card);
    bool empty() const;
    vector<Card> legalMoves(Suit trump, optional<Suit> ledSuit) const;
    string toString() const;
};

struct Bid {
    bool pass = true;
    int tricks = 0;
    Suit trump = Suit::None;

    static Bid makePass();
    static Bid makeBid(int tricksValue, Suit trumpValue);
    string toString() const;
};

struct PlayedCard {
    int playerIndex = 0;
    Card card;
};

struct Trick {
    vector<PlayedCard> plays;

    optional<Suit> ledSuit(Suit trump) const;
    void play(int playerIndex, Card card);
    int winningPlayer(Suit trump) const;
};

struct GameState {
    array<Hand, 4> hands;
    vector<Card> kitty;
    Suit trump = Suit::Spades;
    array<int, 2> teamTricks = {0, 0};
    vector<Trick> completedTricks;

    static GameState dealRandom(Suit trump);
    void recordCompletedTrick(const Trick& trick);
};

string uppercase(string text) {
    for (char& ch : text) {
        ch = static_cast<char>(toupper(static_cast<unsigned char>(ch)));
    }
    return text;
}

char suitToChar(Suit suit) {
    switch (suit) {
        case Suit::Spades: return 'S';
        case Suit::Hearts: return 'H';
        case Suit::Diamonds: return 'D';
        case Suit::Clubs: return 'C';
        case Suit::None: return '-';
    }
    return '-';
}

string suitToString(Suit suit) {
    switch (suit) {
        case Suit::Spades: return "Spades";
        case Suit::Hearts: return "Hearts";
        case Suit::Diamonds: return "Diamonds";
        case Suit::Clubs: return "Clubs";
        case Suit::None: return "None";
    }
    return "None";
}

optional<Suit> suitFromChar(char ch) {
    switch (toupper(static_cast<unsigned char>(ch))) {
        case 'S': return Suit::Spades;
        case 'H': return Suit::Hearts;
        case 'D': return Suit::Diamonds;
        case 'C': return Suit::Clubs;
        default: return nullopt;
    }
}

bool isValidRank(const string& rank) {
    static const vector<string> ranks = {"4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"};
    return find(ranks.begin(), ranks.end(), rank) != ranks.end();
}

bool isRemovedCard(const Card& card) {
    if (card.joker) return false;
    if (card.rank == "2" || card.rank == "3") return true;
    return card.rank == "4" && (card.suit == Suit::Spades || card.suit == Suit::Clubs);
}

bool isValidCard(const Card& card) {
    if (card.joker) return true;
    return card.suit != Suit::None && isValidRank(card.rank) && !isRemovedCard(card);
}

Card parseCard(const string& rawText) {
    string text = uppercase(rawText);
    text.erase(remove_if(text.begin(), text.end(), ::isspace), text.end());

    if (text == "JK" || text == "JOKER") {
        return Card::jokerCard();
    }

    if (text.size() < 2) {
        throw invalid_argument("Card is too short: " + rawText);
    }

    optional<Suit> suit = suitFromChar(text.back());
    if (!suit.has_value()) {
        throw invalid_argument("Invalid suit in card: " + rawText);
    }

    string rank = text.substr(0, text.size() - 1);
    Card card = Card::normal(rank, *suit);

    if (!isValidCard(card)) {
        throw invalid_argument("Invalid or removed card: " + rawText);
    }

    return card;
}

Suit sameColorSuit(Suit suit) {
    switch (suit) {
        case Suit::Hearts: return Suit::Diamonds;
        case Suit::Diamonds: return Suit::Hearts;
        case Suit::Spades: return Suit::Clubs;
        case Suit::Clubs: return Suit::Spades;
        case Suit::None: return Suit::None;
    }
    return Suit::None;
}

bool isRightBower(const Card& card, Suit trump) {
    return !card.joker && card.rank == "J" && card.suit == trump;
}

bool isLeftBower(const Card& card, Suit trump) {
    return !card.joker && card.rank == "J" && card.suit == sameColorSuit(trump);
}

Suit effectiveSuit(const Card& card, Suit trump) {
    if (card.joker) return trump;
    if (isLeftBower(card, trump)) return trump;
    return card.suit;
}

int rankValue(const string& rank) {
    if (rank == "4") return 4;
    if (rank == "5") return 5;
    if (rank == "6") return 6;
    if (rank == "7") return 7;
    if (rank == "8") return 8;
    if (rank == "9") return 9;
    if (rank == "10") return 10;
    if (rank == "J") return 11;
    if (rank == "Q") return 12;
    if (rank == "K") return 13;
    if (rank == "A") return 14;
    throw invalid_argument("Unknown rank: " + rank);
}

int cardStrength(const Card& card, Suit trump, Suit ledSuit) {
    if (card.joker) return 1000;
    if (isRightBower(card, trump)) return 999;
    if (isLeftBower(card, trump)) return 998;

    Suit cardSuit = effectiveSuit(card, trump);

    if (cardSuit == trump) return 500 + rankValue(card.rank);
    if (cardSuit == ledSuit) return 100 + rankValue(card.rank);
    return rankValue(card.rank);
}

string Card::toString() const {
    if (joker) return "JK";
    return rank + suitToChar(suit);
}

Deck Deck::standard500Deck() {
    Deck deck;
    const vector<string> ranks = {"4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"};
    const vector<Suit> suits = {Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs};

    for (Suit suit : suits) {
        for (const string& rank : ranks) {
            Card card = Card::normal(rank, suit);
            if (isValidCard(card)) {
                deck.cards.push_back(card);
            }
        }
    }

    deck.cards.push_back(Card::jokerCard());
    return deck;
}

void Deck::shuffle() {
    random_device rd;
    mt19937 generator(rd());
    std::shuffle(cards.begin(), cards.end(), generator);
}

Card Deck::draw() {
    if (cards.empty()) {
        throw runtime_error("Cannot draw from an empty deck.");
    }

    Card card = cards.back();
    cards.pop_back();
    return card;
}

void Hand::add(Card card) {
    cards.push_back(card);
}

bool Hand::empty() const {
    return cards.empty();
}

vector<Card> Hand::legalMoves(Suit trump, optional<Suit> ledSuit) const {
    if (!ledSuit.has_value()) {
        return cards;
    }

    vector<Card> matchingSuit;
    for (const Card& card : cards) {
        if (effectiveSuit(card, trump) == *ledSuit) {
            matchingSuit.push_back(card);
        }
    }

    if (!matchingSuit.empty()) {
        return matchingSuit;
    }

    return cards;
}

string Hand::toString() const {
    string text;
    for (size_t i = 0; i < cards.size(); ++i) {
        if (i > 0) text += " ";
        text += cards[i].toString();
    }
    return text;
}

Bid Bid::makePass() {
    return Bid{};
}

Bid Bid::makeBid(int tricksValue, Suit trumpValue) {
    if (tricksValue < 6 || tricksValue > 10) {
        throw invalid_argument("500 bids must be between 6 and 10 tricks.");
    }

    Bid bid;
    bid.pass = false;
    bid.tricks = tricksValue;
    bid.trump = trumpValue;
    return bid;
}

string Bid::toString() const {
    if (pass) return "Pass";
    return to_string(tricks) + " " + suitToString(trump);
}

optional<Suit> Trick::ledSuit(Suit trump) const {
    if (plays.empty()) {
        return nullopt;
    }
    return effectiveSuit(plays.front().card, trump);
}

void Trick::play(int playerIndex, Card card) {
    if (plays.size() >= 4) {
        throw runtime_error("A trick can only contain 4 cards.");
    }

    plays.push_back({playerIndex, card});
}

int Trick::winningPlayer(Suit trump) const {
    if (plays.empty()) {
        throw runtime_error("Cannot choose a winner for an empty trick.");
    }

    Suit led = *ledSuit(trump);
    int bestPlayer = plays.front().playerIndex;
    int bestStrength = cardStrength(plays.front().card, trump, led);

    for (const PlayedCard& play : plays) {
        int strength = cardStrength(play.card, trump, led);
        if (strength > bestStrength) {
            bestStrength = strength;
            bestPlayer = play.playerIndex;
        }
    }

    return bestPlayer;
}

GameState GameState::dealRandom(Suit trump) {
    GameState state;
    state.trump = trump;

    Deck deck = Deck::standard500Deck();
    deck.shuffle();

    for (int round = 0; round < 10; ++round) {
        for (int player = 0; player < 4; ++player) {
            state.hands[player].add(deck.draw());
        }
    }

    for (int i = 0; i < 3; ++i) {
        state.kitty.push_back(deck.draw());
    }

    return state;
}

void GameState::recordCompletedTrick(const Trick& trick) {
    int winner = trick.winningPlayer(trump);
    int teamIndex = (winner == 0 || winner == 2) ? 0 : 1;
    teamTricks[teamIndex] += 1;
    completedTricks.push_back(trick);
}

void printCards(const vector<Card>& cards) {
    for (const Card& card : cards) {
        cout << card.toString() << " ";
    }
}

bool containsCard(const vector<Card>& cards, const string& cardText) {
    for (const Card& card : cards) {
        if (card.toString() == cardText) {
            return true;
        }
    }
    return false;
}

bool sameCardList(const vector<Card>& actual, const vector<string>& expected) {
    if (actual.size() != expected.size()) {
        return false;
    }

    for (size_t i = 0; i < actual.size(); ++i) {
        if (actual[i].toString() != expected[i]) {
            return false;
        }
    }

    return true;
}

void requireTest(bool condition, const string& message) {
    if (!condition) {
        throw runtime_error(message);
    }
}

void runTest(const string& name, void (*testFunction)(), int& passed, int& failed) {
    try {
        testFunction();
        ++passed;
        cout << "[PASS] " << name << "\n";
    } catch (const exception& ex) {
        ++failed;
        cout << "[FAIL] " << name << ": " << ex.what() << "\n";
    }
}

void testDeckSizeIs43() {
    Deck deck = Deck::standard500Deck();
    requireTest(deck.cards.size() == 43, "Deck should contain exactly 43 cards.");
}

void testRemovedCardsAreNotInDeck() {
    Deck deck = Deck::standard500Deck();

    requireTest(!containsCard(deck.cards, "2H"), "2H should not be in the deck.");
    requireTest(!containsCard(deck.cards, "3S"), "3S should not be in the deck.");
    requireTest(!containsCard(deck.cards, "4S"), "4S should not be in the deck.");
    requireTest(!containsCard(deck.cards, "4C"), "4C should not be in the deck.");
}

void testJokerExists() {
    Deck deck = Deck::standard500Deck();
    requireTest(containsCard(deck.cards, "JK"), "Joker should be in the deck.");
}

void testLeftBowerCountsAsTrump() {
    Card leftBower = parseCard("JD");
    requireTest(effectiveSuit(leftBower, Suit::Hearts) == Suit::Hearts,
                "JD should count as Hearts when Hearts are trump.");
}

void testMustFollowEffectiveSuitIfPossible() {
    Hand hand;
    hand.add(parseCard("JD"));
    hand.add(parseCard("AS"));
    hand.add(parseCard("9C"));

    vector<Card> legal = hand.legalMoves(Suit::Hearts, Suit::Hearts);

    requireTest(sameCardList(legal, {"JD"}),
                "Player should have to play the left bower because it is effectively trump.");
}

void testJokerBeatsRightBower() {
    Trick trick;
    trick.play(0, parseCard("JH"));
    trick.play(1, parseCard("JK"));

    requireTest(trick.winningPlayer(Suit::Hearts) == 1,
                "Joker should beat the right bower.");
}

void testRightBowerBeatsLeftBower() {
    Trick trick;
    trick.play(0, parseCard("JD"));
    trick.play(1, parseCard("JH"));

    requireTest(trick.winningPlayer(Suit::Hearts) == 1,
                "Right bower should beat the left bower.");
}

void testTrumpBeatsLedNonTrump() {
    Trick trick;
    trick.play(0, parseCard("AS"));
    trick.play(1, parseCard("4H"));
    trick.play(2, parseCard("KS"));

    requireTest(trick.winningPlayer(Suit::Hearts) == 1,
                "Any trump should beat led non-trump cards.");
}

void testLedSuitBeatsOffSuitNonTrump() {
    Trick trick;
    trick.play(0, parseCard("9S"));
    trick.play(1, parseCard("AC"));
    trick.play(2, parseCard("KS"));

    requireTest(trick.winningPlayer(Suit::Hearts) == 2,
                "Highest led-suit card should beat off-suit non-trump cards.");
}

void testTrickWinnerWorksCorrectly() {
    Trick trick;
    trick.play(0, parseCard("AH"));
    trick.play(1, parseCard("JD"));
    trick.play(2, parseCard("JH"));
    trick.play(3, parseCard("JK"));

    requireTest(trick.winningPlayer(Suit::Hearts) == 3,
                "Joker should win over right bower, left bower, and ace of trump.");
}

int runTests() {
    int passed = 0;
    int failed = 0;

    cout << "Five Hundred native rules tests\n";
    runTest("Deck size is 43", testDeckSizeIs43, passed, failed);
    runTest("Removed cards are not in the deck", testRemovedCardsAreNotInDeck, passed, failed);
    runTest("Joker exists", testJokerExists, passed, failed);
    runTest("Left bower counts as trump", testLeftBowerCountsAsTrump, passed, failed);
    runTest("Must follow effective suit if possible", testMustFollowEffectiveSuitIfPossible, passed, failed);
    runTest("Joker beats right bower", testJokerBeatsRightBower, passed, failed);
    runTest("Right bower beats left bower", testRightBowerBeatsLeftBower, passed, failed);
    runTest("Trump beats led non-trump", testTrumpBeatsLedNonTrump, passed, failed);
    runTest("Led suit beats off-suit non-trump", testLedSuitBeatsOffSuitNonTrump, passed, failed);
    runTest("Trick winner works correctly", testTrickWinnerWorksCorrectly, passed, failed);

    cout << "\nPassed: " << passed << ", Failed: " << failed << "\n";
    return failed == 0 ? 0 : 1;
}

int runDemo() {
    try {
        Deck deck = Deck::standard500Deck();
        cout << "Five Hundred native rules demo\n";
        cout << "Deck size: " << deck.cards.size() << "\n";

        GameState game = GameState::dealRandom(Suit::Hearts);
        cout << "Trump for demo: " << suitToString(game.trump) << "\n\n";

        for (int player = 0; player < 4; ++player) {
            cout << "Player " << player + 1 << ": " << game.hands[player].toString() << "\n";
        }

        cout << "Kitty: ";
        printCards(game.kitty);
        cout << "\n\n";

        Card leftBower = parseCard("JD");
        cout << leftBower.toString() << " effective suit with Hearts trump: "
             << suitToString(effectiveSuit(leftBower, Suit::Hearts)) << "\n";

        Trick trick;
        trick.play(0, parseCard("AH"));
        trick.play(1, parseCard("JD"));
        trick.play(2, parseCard("JH"));
        trick.play(3, parseCard("JK"));

        cout << "Sample trick: ";
        for (const PlayedCard& play : trick.plays) {
            cout << "P" << play.playerIndex + 1 << "=" << play.card.toString() << " ";
        }
        cout << "\nWinner: Player " << trick.winningPlayer(Suit::Hearts) + 1 << "\n";

        game.recordCompletedTrick(trick);
        cout << "Team tricks: P1/P3=" << game.teamTricks[0]
             << ", P2/P4=" << game.teamTricks[1] << "\n";
    } catch (const exception& ex) {
        cerr << "Error: " << ex.what() << "\n";
        return 1;
    }

    return 0;
}

int main(int argc, char* argv[]) {
    if (argc > 1 && string(argv[1]) == "--test") {
        return runTests();
    }

    return runDemo();
}
