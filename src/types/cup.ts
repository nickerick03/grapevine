export interface CupRecord {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  rewardPoints: number;
  description: string | null;
  artworkUrl: string | null;
  svgMarkup: string | null;
  isActive: boolean;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  secondsLeft: number;
}

export interface CupLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  city: string;
  cupScore: number;
  allTimeScore: number;
  helpfulVotes: number;
  firstRatings: number;
  reviews: number;
  notes: number;
  cities: number;
  cityList: string[];
  scoreReachedAt: string | null;
}

export interface PublicProfileCupPlacement {
  cupId: string;
  cupName: string;
  cupDescription: string | null;
  cupArtworkUrl: string | null;
  cupRewardPoints: number;
  placement: 1 | 2 | 3;
  cupScore: number;
  rewardPointsAwarded: number;
  badgeSvgMarkup: string | null;
  cupStartAt: string | null;
  cupEndAt: string | null;
  awardedAt: string;
}

export interface AdminCupFinalizeResult {
  cupId: string;
  placementsSaved: number;
  rewardsSaved: number;
  alreadyFinalized: boolean;
}
