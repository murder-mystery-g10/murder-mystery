# Case design rules

These rules decide whether a case is fair and fun to play. Case authors and the AI generator
follow them, and `POST /validate` on the AI service checks them (see
[contracts](contracts/README.md#ai-service-api)).

The case schema (`shared_schemas.case`) already rejects broken references, such as a clue that
points to an unknown room. The rules below go further: they check the design of the mystery.

The reference case is "Moarte la Conacul Vornicu": 4 suspects, 6 rooms, 4 players.

## Clue types

Every physical clue has one main type (`Clue.type`). It can have extra roles in `Clue.also`, but
it is counted under its main type.

| Code | Type | What it does | Reference case | Rule of thumb for a new case |
|---|---|---|---|---|
| `C` | Critical | Proves one pillar of the solution (`Clue.pillar`) | 9 | see below |
| `F` | False lead | Makes an innocent suspect look guilty | 3 | 1 per innocent |
| `E` | Elimination | Disproves a false lead or gives an alibi (`Clue.refutes`) | 3 physical + 3 verbal | ≥1 physical + ≥1 verbal per innocent |
| `P` | Leverage | Proves a suspect's secret; makes them break when shown | 4 | 1 per innocent (+1 optional) |
| `A` | Access | A key, a code or a hint for a locked door | 4 | 1 per lock (+1 for a two-part code) |
| `T` | Context | Timeline, relationships, atmosphere | 2 | 2–3 |

Critical clues by pillar:

| Pillar | Proves | Reference case | New case |
|---|---|---|---|
| `method` | How the victim died | 3 | 3 |
| `means` | The culprit had access to the weapon or poison | 2 | 2–3 |
| `motive` | Why the culprit did it | 3 | 3 |
| `opportunity` | The culprit was at the scene at the right time | 1 physical + 3 verbal | 1 physical + ≥2 verbal |

Verbal clues are testimonies (`Suspect.testimonies`): facts a suspect only tells when asked the
right question.

**Total physical clues** = 9 + 3 × (suspects − 1) + access clues + 2, plus 0–2 optional
leverage clues. The reference case has 9 + 9 + 4 + 2 + 1 = 25. A 3-suspect case has about 21,
a 5-suspect case about 28.

**Per room:** the crime scene and the key rooms have 5 clues, the others 3–4. More than 5 in one
room turns the investigation into pixel hunting.

**Difficulty:**

| Difficulty | Changes | Questions per suspect |
|---|---|---|
| `easy` | Opportunity also has 2 physical clues; no two-part codes | 8 |
| `normal` | As in the tables above | 6 |
| `hard` | 2 false leads per innocent; key testimonies only after the suspect admits their secret | 4 |

## Room distribution

Each player can enter 3 of the 6 rooms, each room is open to exactly 2 players, and every pair of
players shares exactly one room. Players have to talk to each other, but nobody is stuck.

Reference case (`J1`–`J4` are the player slots):

| Room | At start | J1 | J2 | J3 | J4 |
|---|---|---|---|---|---|
| Hall | open | ✓ | | ✓ | |
| Library (crime scene) | open | ✓ | ✓ | | |
| Kitchen | open | | ✓ | | ✓ |
| Master bedroom | locked (key) | ✓ | | | ✓ |
| Guest room 2 | locked (key) | | | ✓ | ✓ |
| Greenhouse | code lock | | ✓ | ✓ | |

## The 7 rules

1. **Rule of two.** Every pillar of the solution (method, means, motive, opportunity) has at
   least 2 independent clues, in at least 2 different rooms.
2. **Nobody solves it alone.** No player can reach all 4 pillars through their own rooms. Each
   player misses at least one.
3. **Nobody waits.** Every player has at least one room that is open at the start.
4. **Locks connect players.** At least one lock can only be opened by combining information from
   the rooms of two different players.
5. **Every false lead can be disproved** by at least one clue in a different room.
6. **Every innocent suspect has a secret** that gives them a reason to lie. Without a secret the
   AI has no reason to lie, and players rule the suspect out at once.
7. **The culprit cannot be convicted on testimony alone.** Testimonies point to the culprit;
   physical clues prove it.

## Checklist for a new case

A case is ready only when every item is checked.

- [ ] The truth is complete: culprit, motive, method and a minute-by-minute timeline.
- [ ] The number of clues per type follows the [clue types](#clue-types) section.
- [ ] Method, means and motive each have ≥2 clues in ≥2 rooms; opportunity has ≥1 physical clue
  and ≥2 testimonies.
- [ ] No player reaches all 4 pillars through their own rooms.
- [ ] Every player has ≥1 room open at the start.
- [ ] At least one lock needs information from two players.
- [ ] Every false lead has ≥1 elimination clue in another room.
- [ ] Every innocent suspect has a secret, a lie and a piece of evidence that makes them break.
- [ ] At least one key testimony is unlocked only after a suspect admits their secret.
- [ ] No clue contradicts the timeline.
- [ ] The culprit cannot be convicted on testimony alone.
- [ ] No room has more than 5 clues.
