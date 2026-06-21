export interface StripList {
  prep_verbs: string[];
  modifying_adverbs: string[];
  size_adjectives: string[];
  quality_qualifiers: string[];
  connectives: string[];
  prepositions: string[];
  cut_descriptors: string[];
}

export function getStripList(): StripList {
  return {
    prep_verbs: [
      'chopped', 'minced', 'sliced', 'diced', 'drained', 'rinsed',
      'grated', 'crushed', 'juiced', 'peeled', 'halved', 'quartered',
      'torn', 'shredded', 'mashed', 'beaten', 'softened', 'washed',
      'cut', 'chunked',
    ],
    modifying_adverbs: [
      'finely', 'roughly', 'thinly', 'coarsely', 'lightly', 'very',
    ],
    size_adjectives: [
      'large', 'medium', 'small',
    ],
    quality_qualifiers: [
      'free-range', 'organic', 'grass-fed',
    ],
    connectives: [
      'and', 'then',
    ],
    prepositions: [
      'into', 'on', 'the',
    ],
    // cut shapes, directions, and similar position words found in cutting instructions
    cut_descriptors: [
      'dice', 'slices', 'diagonal',
    ],
  };
}
