# Five Hundred Strategy Table

Five Hundred Strategy Table is a browser-based table tracker and play advisor for the four-player partnership version of 500.

The app runs as a static website, so it can be hosted directly on GitHub Pages with no build step and no server.

## Features

- Four-player table layout
- Partnership display for Player 1 + Player 3 and Player 2 + Player 4
- 43-card 500 deck support with one Joker
- Random deal generation
- Manual hand and kitty entry
- Card validation for duplicates, invalid cards, and removed cards
- Bidding tracker
- Kitty pickup and discard flow
- Trick-by-trick play tracking
- Legal-card highlighting
- Trump, bower, and Joker handling
- Team trick count
- Card counter for played and unseen cards
- Play advisor mode for tracking your own hand during a game

## Card Notation

Use short card codes separated by spaces or commas.

```text
AS  = Ace of Spades
10H = Ten of Hearts
JD  = Jack of Diamonds
JK  = Joker
```

The supported 500 deck contains:

```text
JK
4H 4D
5 through A in S, H, D, and C
```

The deck does not include any 2s, any 3s, 4S, or 4C.

### Table Mode

1. Choose the dealer.
2. Click **Deal Random Hands** or manually enter each player's 10-card hand and the 3-card kitty.
3. Click **Load Hands**.
4. Click **Start Bidding**.
5. Record passes and bids until bidding is complete.
6. If a contract is made, click **Pick Up Kitty** for the winning bidder.
7. Select 3 cards to discard and click **Discard Selected 3**.
8. Play the hand by clicking each player's legal cards in turn.
9. Review trick count, contract status, card counts, and play recommendations.

### Play Advisor

1. Choose which player you are.
2. Choose the dealer.
3. Enter your 10-card hand.
4. Click **Start Hand**.
5. Record the bidding as it happens.
6. If you win the bid, enter the kitty and use the discard recommendation.
7. Record each played card during the hand.
8. Use the advisor recommendation when it is your turn to play.
