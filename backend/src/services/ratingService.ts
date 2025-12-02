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

// Glicko-2 constant for RD growth (c)
const C = 63.2;

export const RatingService = {
  // Apply inactivity RD growth based on days since last update
  applyInactivityGrowth(rd: number, lastUpdateAt: Date): number {
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - new Date(lastUpdateAt).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate <= 0) {
      return rd; // No growth if updated today or in the future
    }

    // RD growth formula: newRD = min(350, sqrt(oldRD^2 + c^2 * days))
    const newRd = Math.min(350, Math.sqrt(rd * rd + C * C * daysSinceUpdate));
    return newRd;
  },

  // Update ratings after a match
  async updateRatings(
    player1RatingId: number,
    player1Rating: number,
    player1Rd: number,
    player1Vol: number,
    player1LastUpdate: Date,
    player2RatingId: number,
    player2Rating: number,
    player2Rd: number,
    player2Vol: number,
    player2LastUpdate: Date,
    outcome: number // 1 = player1 wins, 0 = player2 wins, 0.5 = draw
  ) {
    // Apply inactivity RD growth before Glicko-2 calculation
    const p1RdAdjusted = this.applyInactivityGrowth(player1Rd, player1LastUpdate);
    const p2RdAdjusted = this.applyInactivityGrowth(player2Rd, player2LastUpdate);

    // Create Glicko-2 player objects with adjusted RD
    const p1 = glicko.makePlayer(player1Rating, p1RdAdjusted, player1Vol);
    const p2 = glicko.makePlayer(player2Rating, p2RdAdjusted, player2Vol);

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
    console.log(`💾 Saving rating 1: id=${player1RatingId} rating=${p1.getRating()} rd=${p1.getRd()} vol=${p1.getVol()}`);
    await PlayerRatingModel.update(
      player1RatingId,
      p1.getRating(),
      p1.getRd(),
      p1.getVol()
    );
    console.log(`✅ Rating 1 saved`);

    console.log(`💾 Saving rating 2: id=${player2RatingId} rating=${p2.getRating()} rd=${p2.getRd()} vol=${p2.getVol()}`);
    await PlayerRatingModel.update(
      player2RatingId,
      p2.getRating(),
      p2.getRd(),
      p2.getVol()
    );
    console.log(`✅ Rating 2 saved`);

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
