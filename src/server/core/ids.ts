export const isT1 = (id: string): id is `t1_${string}` => id.startsWith('t1_');
export const isT3 = (id: string): id is `t3_${string}` => id.startsWith('t3_');
