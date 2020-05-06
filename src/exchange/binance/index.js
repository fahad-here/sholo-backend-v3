import { BaseExchange } from '../base'

export class Binance extends BaseExchange {
    constructor(options) {
        const id = 'binance'
        super(id, options)
    }
}
