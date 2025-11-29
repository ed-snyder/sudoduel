import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';

const DEFAULT_LADDER_ID = 1;

export const PlayerService = {
  // Get full player info with rating
  async getPlayerInfo(userId: number) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    
    if (!profile) {
      throw new Error('Player profile not found');
    }

    const rating = await PlayerRatingModel.findByPlayerAndLadder(
      profile.id,
      DEFAULT_LADDER_ID
    );

    return {
      id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      country_code: profile.country_code,
      rating: rating?.rating || 1500,
      rd: rating?.rd || 350,
      games_played: rating?.games_played || 0,
    };
  },
};
