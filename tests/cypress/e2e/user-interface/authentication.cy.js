describe("authentication", () => {
  it("should allow logging users in w/ correct credentials", () => {
    cy.visit(Cypress.env("baseUrl") || "http://localhost:3000");
    // cy.get("#popup-notification--1__close-button").click();
    // cy.get("#main-menu-screen-button--settings").click();
    // cy.get("#settings-screen__sidebar-item--online").click();
    cy.get("#authentication-modal__username").type("mistertfy64water");
    // password in testing db should be changed to this
    cy.get("#authentication-modal__password").type("password-mistertfy64water");
    cy.get("#settings-screen__content--online__submit").click();
    // shouldn't take longer than 1000ms
    cy.wait(1000);
    cy.get("#user-account-stat--username").should("have.text", "mistertfy64water");
  });

  it("should not allow logging users in w/ incorrect credentials", () => {
    cy.visit(Cypress.env("baseUrl") || "http://localhost:3000");
    // cy.get("#popup-notification--1__close-button").click();
    // cy.get("#main-menu-screen-button--settings").click();
    // cy.get("#settings-screen__sidebar-item--online").click();
    cy.get("#authentication-modal__username").type("mistertfy64water");
    cy.get("#authentication-modal__password").type("password-mistertfy64water-incorrect");
    cy.get("#settings-screen__content--online__submit").click();
    // shouldn't take longer than 1000ms
    cy.wait(1000);
    cy.get("#user-account-stat--username").should("not.have.text", "mistertfy64water");
  });

  it("should not allow logging users in w/ invalid credentials", () => {
    cy.visit(Cypress.env("baseUrl") || "http://localhost:3000");
    // cy.get("#popup-notification--1__close-button").click();
    // cy.get("#main-menu-screen-button--settings").click();
    // cy.get("#settings-screen__sidebar-item--online").click();
    cy.get("#authentication-modal__username").type("<script>alert(1)</script>");
    cy.get("#authentication-modal__password").type("password-mistertfy64water");
    cy.get("#settings-screen__content--online__submit").click();
    // shouldn't take longer than 1000ms
    cy.wait(1000);
    cy.get("#user-account-stat--username").should("not.have.text", "mistertfy64water");
  });
});
