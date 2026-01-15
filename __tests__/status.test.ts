import { parse } from '../src/status'

describe('Status', () => {
    it('should parse success status', () => {
        expect(parse('success')).toBe('success')
    })

    it('should parse failure status', () => {
        expect(parse('failure')).toBe('failure')
    })

    it('should parse cancelled status', () => {
        expect(parse('cancelled')).toBe('cancelled')
    })

    it('should be case-insensitive', () => {
        expect(parse('SUCCESS')).toBe('success')
        expect(parse('Failure')).toBe('failure')
    })

    it('should throw error for invalid status', () => {
        expect(() => parse('invalid')).toThrow('Invalid parameter. status=invalid.')
    })
})
