import { BaseExchange } from '../base'

export class Bitmex extends BaseExchange {
    constructor(options) {
        const id = 'bitmex'
        super(id, options)
    }
}
