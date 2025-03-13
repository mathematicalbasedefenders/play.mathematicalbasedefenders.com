describe("keypresses", () => {
  it("should allow users to exit multiplayer room intermission through abort key", () => {
    cy.visit(Cypress.env("baseUrl") || "http://localhost:3000");
    cy.get("#opening-screen__play-as-guest").click();

    cy.get("body").then(($body) => {
      if ($body.find("#popup-notification--1__close-button").length) {
        cy.get("#popup-notification--1__close-button").click();
      }
    });

    cy.get("#main-menu-screen-button--multiplayer").click();
    cy.get("#multiplayer-menu-screen-button--default").click();
    cy.get("#chat-message").should("be.visible");
    cy.wait(500); // here because sometimes it doesn't work lol
    cy.get("body").type(`{esc}`);
    cy.get("#main-menu-screen-button--singleplayer").should("be.visible");
  });
});
