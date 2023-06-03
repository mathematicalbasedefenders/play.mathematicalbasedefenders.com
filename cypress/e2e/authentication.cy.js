describe("authentication", () => {
  it("should allow logging users in", () => {
    cy.visit("http://localhost:3000");
    cy.get("#main-menu-screen-button--settings").click();
    cy.get("#settings-screen__sidebar-item--online").click();
    cy.get("#settings-screen__content--online__username").type("mistertfy64water");
    cy.get("#settings-screen__content--online__password").type("password-mistertfy64water");
    cy.get("#settings-screen__content--online__submit").click();
    // shouldn't take longer than 3000ms
    cy.wait(3000);
    cy.get("#user-account-stat--username").should("have.text", "mistertfy64water");
  });
});
