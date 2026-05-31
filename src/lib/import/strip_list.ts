export interface StripList {
  prep_verbs: string[];
  modifying_adverbs: string[];
  size_adjectives: string[];
}

export function getStripList(): StripList {
  return {
    prep_verbs: [
      'chopped', 'minced', 'sliced', 'diced', 'drained', 'rinsed',
      'grated', 'crushed', 'juiced', 'peeled', 'halved', 'quartered',
      'torn', 'shredded', 'mashed', 'beaten', 'softened', 'washed',
    ],
    modifying_adverbs: [
      'finely', 'roughly', 'thinly', 'coarsely', 'lightly',
    ],
    size_adjectives: [
      'large', 'medium', 'small',
    ],
  };
}
