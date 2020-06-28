module.exports = (name, whatPrice, price, liquidation, account) => {
    return `
        <p>
        Hello  ${name},
        </p>
        <p>This is to notify you that the ${whatPrice} $(${price}) has been reached.</p>
        <p>${
            liquidation
                ? 'And you to this you have been liquidated on your bitmex account ' +
                  account.accountName
                : ''
        }</p>
        <p>Ignore this email if you have not requested it.</p>
        <p>This link will expire within 2 hours</p>
    `
}
