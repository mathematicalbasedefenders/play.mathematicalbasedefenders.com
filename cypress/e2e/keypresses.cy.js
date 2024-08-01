describe("keypresses", () => {
  it("should allow users to exit multiplayer room intermission through abort key", () => {
    cy.visit(Cypress.env("baseUrl") || "http://localhost:3000");
    cy.get("#popup-notification--1__close-button").click();
    cy.get("#main-menu-screen-button--multiplayer").click();
    cy.get("#multiplayer-menu-screen-button--default").click();
    cy.get("#chat-message").should("be.visible").type(`{esc}`);
    cy.get("#main-menu-screen-button--singleplayer").should("be.visible");
  });
});
