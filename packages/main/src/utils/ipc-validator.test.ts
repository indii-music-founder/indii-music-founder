import { describe, it, expect } from 'vitest';
import { validators } from './ipc-validator';

describe('validators.string', () => {
    describe('Type Validation', () => {
        it('should throw if input is not a string', () => {
            const validator = validators.string();
            expect(() => validator(123)).toThrow('Expected string, got number');
            expect(() => validator({})).toThrow('Expected string, got object');
            expect(() => validator([])).toThrow('Expected string, got object');
            expect(() => validator(null)).toThrow('Expected string, got object');
            expect(() => validator(undefined)).toThrow('Expected string, got undefined');
            expect(() => validator(true)).toThrow('Expected string, got boolean');
        });

        it('should pass if input is a string', () => {
            const validator = validators.string({ allowEmpty: true });
            expect(validator('hello')).toBe('hello');
            expect(validator('')).toBe('');
        });
    });

    describe('Empty String Handling (allowEmpty)', () => {
        it('should throw on empty string by default (allowEmpty = false)', () => {
            // Note: sanitize=true is default, which trims whitespace
            const validator = validators.string();
            expect(() => validator('')).toThrow('String cannot be empty');
            expect(() => validator('   ')).toThrow('String cannot be empty'); // Will be trimmed to '' first
        });

        it('should throw on empty string when allowEmpty is explicitly false', () => {
            const validator = validators.string({ allowEmpty: false });
            expect(() => validator('')).toThrow('String cannot be empty');
        });

        it('should allow empty string when allowEmpty is true', () => {
            const validator = validators.string({ allowEmpty: true });
            expect(validator('')).toBe('');
            // With sanitize=true (default), '   ' becomes ''
            expect(validator('   ')).toBe('');
        });
    });

    describe('Length Boundaries (minLength & maxLength)', () => {
        it('should throw if string is shorter than minLength', () => {
            const validator = validators.string({ minLength: 3 });
            expect(() => validator('ab')).toThrow('String must be at least 3 characters');
            expect(validator('abc')).toBe('abc');
        });

        it('should throw if string is longer than maxLength', () => {
            const validator = validators.string({ maxLength: 5 });
            expect(() => validator('abcdef')).toThrow('String cannot exceed 5 characters');
            expect(validator('abcde')).toBe('abcde');
        });

        it('should handle exact length matches', () => {
            const validator = validators.string({ minLength: 4, maxLength: 4 });
            expect(validator('abcd')).toBe('abcd');
            expect(() => validator('abc')).toThrow('String must be at least 4 characters');
            expect(() => validator('abcde')).toThrow('String cannot exceed 4 characters');
        });
    });

    describe('Sanitization (sanitize)', () => {
        it('should sanitize by default (trim whitespace and remove control chars)', () => {
            const validator = validators.string();
            expect(validator('  hello  ')).toBe('hello');

            // \x00-\x08\x0B\x0C\x0E-\x1F\x7F are removed
            expect(validator('hel\x00lo')).toBe('hello');
            expect(validator('\x01\x02\x08test\x0B\x0C\x7F')).toBe('test');

            // Note: \n (0x0A) and \r (0x0D) are NOT in the regex, but .trim() removes them from the ends.
            // Let's test inner \n. It should be kept.
            expect(validator('hello\nworld')).toBe('hello\nworld');
        });

        it('should not sanitize when sanitize is false', () => {
            const validator = validators.string({ sanitize: false });
            expect(validator('  hello  ')).toBe('  hello  ');
            expect(validator('hel\x00lo')).toBe('hel\x00lo');
        });

        it('should allowEmpty properly when sanitize is false', () => {
             const validator = validators.string({ sanitize: false, allowEmpty: false });
             // '   ' is not empty (length 3), so it passes allowEmpty check when not trimmed
             expect(validator('   ')).toBe('   ');
        });
    });

    describe('Pattern Validation (pattern)', () => {
        it('should pass if string matches pattern', () => {
            const validator = validators.string({ pattern: /^[a-z]+$/ });
            expect(validator('hello')).toBe('hello');
        });

        it('should throw if string does not match pattern', () => {
            const validator = validators.string({ pattern: /^[a-z]+$/ });
            expect(() => validator('Hello')).toThrow('String does not match required pattern');
            expect(() => validator('hello123')).toThrow('String does not match required pattern');
            expect(() => validator('hello world')).toThrow('String does not match required pattern');
        });

        it('should test pattern after sanitization', () => {
            // "  hello  " becomes "hello", which matches the pattern
            const validator = validators.string({ pattern: /^[a-z]+$/ });
            expect(validator('  hello  ')).toBe('hello');

            // "hel\x00lo" becomes "hello", which matches the pattern
            expect(validator('hel\x00lo')).toBe('hello');
        });
    });
});
