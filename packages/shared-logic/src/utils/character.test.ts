import { describe, it, expect } from 'vitest';
import { normalizeCharacterName, findCharacter } from './character';

describe('normalizeCharacterName', () => {
  it('should return empty string for empty input', () => {
    expect(normalizeCharacterName('')).toBe('');
    expect(normalizeCharacterName(null as any)).toBe('');
    expect(normalizeCharacterName(undefined as any)).toBe('');
  });

  it('should convert to lowercase', () => {
    expect(normalizeCharacterName('Peter Parker')).toBe('peter parker');
  });

  it('should remove text in parentheses', () => {
    expect(normalizeCharacterName('Spider-Man (Peter Parker)')).toBe('spider-man');
    expect(normalizeCharacterName('Batman (uncredited)')).toBe('batman');
  });

  it('should remove text in quotes', () => {
    expect(normalizeCharacterName('James "Logan" Howlett')).toBe('james howlett');
    expect(normalizeCharacterName("Dwayne 'The Rock' Johnson")).toBe('dwayne johnson');
  });

  it('should normalize spaces', () => {
    expect(normalizeCharacterName('  Iron   Man  ')).toBe('iron man');
  });

  it('should handle combination of modifications', () => {
    expect(normalizeCharacterName('  Peter   "Spider-Man" Parker (young) ')).toBe('peter parker');
  });
});

describe('findCharacter', () => {
  it('should return false for falsy inputs', () => {
    expect(findCharacter('', 'Batman')).toBe(false);
    expect(findCharacter('Batman', '')).toBe(false);
    expect(findCharacter(null as any, 'Batman')).toBe(false);
  });

  it('should return true for exact matches', () => {
    expect(findCharacter('Batman', 'Batman')).toBe(true);
    expect(findCharacter('Peter Parker', 'peter parker')).toBe(true);
  });

  it('should match multiple characters separated by slash', () => {
    expect(findCharacter('Peter Parker / Spider-Man', 'Spider-Man')).toBe(true);
    expect(findCharacter('Peter Parker', 'Peter Parker / Spider-Man')).toBe(true);
    expect(findCharacter('Batman / Bruce Wayne', 'Bruce Wayne')).toBe(true);
  });

  it('should match when one name is fully contained in another as words', () => {
    expect(findCharacter('Peter Parker', 'Peter')).toBe(true);
    expect(findCharacter('Peter', 'Peter Parker')).toBe(true);
    expect(findCharacter('Spider-Man', 'The Amazing Spider-Man')).toBe(true);
    expect(findCharacter('The Amazing Spider-Man', 'Spider-Man')).toBe(true);
  });

  it('should not match partial words (prevent false positives)', () => {
    expect(findCharacter('Samantha', 'Sam')).toBe(false);
    expect(findCharacter('Sam', 'Samantha')).toBe(false);
    expect(findCharacter('Tony Stark', 'Ton')).toBe(false);
    expect(findCharacter('Robb Stark', 'Rob')).toBe(false);
  });

  it('should handle complex names with parentheses and quotes', () => {
    expect(findCharacter('Peter Parker (Spider-Man)', 'Peter Parker')).toBe(true);
    // Since parentheses are removed in normalization: 'Peter Parker (Spider-Man)' becomes 'peter parker'
    expect(findCharacter('Peter Parker (Spider-Man)', 'Spider-Man')).toBe(false); 
    
    // Test with quotes
    expect(findCharacter('James "Logan" Howlett', 'James Howlett')).toBe(true);
    expect(findCharacter('James "Logan" Howlett', 'Logan')).toBe(false); // "Logan" is removed in normalization
  });
});
