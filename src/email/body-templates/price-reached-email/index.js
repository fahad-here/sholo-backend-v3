module.exports = (name, whatPrice, price, liquidation, account, bot) => {
    return `
        <p>
        Hello ${name},
        </p>
        <p>This is to notify you that the ${whatPrice} $(${price}) has been reached.</p>
        <p>${
            liquidation
                ? 'And due to this you have been liquidated on your bitmex account ' +
                  account.accountName
                : ''
        }</p>
        <p>This is an auto-generated email sent via the bot: ${bot.name}.</p>
    `
}
