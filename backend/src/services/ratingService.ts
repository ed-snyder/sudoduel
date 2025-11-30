import Glicko2 from 'glicko2';
import { PlayerRatingModel } from '../models/PlayerRating';

// Glicko-2 settings
const settings = {
  tau: 0.5,        // System constant (volatility change)
  rating: 1500,    // Default rating
  rd: 350,         // Default rating deviation
  vol: 0.06,       // Default volatility
};

const glicko = new Glicko2.Glicko2(settings);

export const RatingService = {
  // Update ratings after a match
  async updateRatings(
    player1RatingId: number,
    player1Rating: number,
    player1Rd: number,
    player1Vol: number,
    player2RatingId: number,
    player2Rating: number,
    player2Rd: number,
    player2Vol: number,
    outcome: number // 1 = player1 wins, 0 = player2 wins, 0.5 = draw
  ) {
    // Create Glicko-2 player objects
    const p1 = glicko.makePlayer(player1Rating, player1Rd, player1Vol);
    const p2 = glicko.makePlayer(player2Rating, player2Rd, player2Vol);

    // Create matches array
    const matches: any[] = [];
    
    if (outcome === 1) {
      // Player 1 wins
      matches.push([p1, p2, 1]); // player1 vs player2, player1 won
    } else if (outcome === 0) {
      // Player 2 wins
      matches.push([p1, p2, 0]); // player1 vs player2, player2 won
    } else {
      // Draw
      matches.push([p1, p2, 0.5]); // draw
    }

    // Update ratings
    glicko.updateRatings(matches);

    // Save updated ratings to database
    await PlayerRatingModel.update(
      player1RatingId,
      p1.getRating(),
      p1.getRd(),
      p1.getVol()
    );

    await PlayerRatingModel.update(
      player2RatingId,
      p2.getRating(),
      p2.getRd(),
      p2.getVol()
    );

    return {
      player1: {
        rating: p1.getRating(),
        rd: p1.getRd(),
        volatility: p1.getVol(),
      },
      player2: {
        rating: p2.getRating(),
        rd: p2.getRd(),
        volatility: p2.getVol(),
      },
    };
  },
};
