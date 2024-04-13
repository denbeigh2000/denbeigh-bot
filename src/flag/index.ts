const LETTER_OFFSET = 127462;

function emojiLetter(letter: string): string {
    const distFromA = parseInt(letter[0], 36) - 10
    return String.fromCodePoint(LETTER_OFFSET + distFromA);
}

function emojiFromCode(code: string): string {
    if (code.length !== 2) {
        throw `bad code len ${code.length}`;
    }

    const [a, b] = [code[0], code[1]];
    return emojiLetter(a) + emojiLetter(b);
}
