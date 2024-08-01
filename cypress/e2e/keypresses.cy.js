describe("keypresses", () => {
  it("should allow users to exit multiplayer room intermission through abort key", () => {
    cy.visit("http://localhost:3000");
    cy.get("#popup-notification--1__close-button").click();
    cy.get("#main-menu-screen-button--multiplayer").click();
    cy.get("#multiplayer-menu-screen-button--default").click();
    cy.wait(1000);
    cy.get("#chat-message").type(`{esc}`);
    cy.get("#main-menu-screen-button--singleplayer").should("be.visible");
  });
});
