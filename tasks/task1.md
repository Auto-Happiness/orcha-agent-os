OBJECT: LoginPage
DECLARE Container FullPage
    SET Width = 100%
    SET Display = Flexbox (Horizontal Split)

    SECTION VisualPane (Left Side)
        IF ScreenWidth > Mobile THEN
            SHOW HeroImage (High Contrast)
            RENDER BrandLogo (Upper Left)
            DISPLAY Tagline ("Orcha Agent O7")
        END IF

    SECTION AuthPane (Right Side)
        INIT AuthForm (Centered)
            HEADER "Sign In" (Typography: Bold)
            SUBTEXT "Enter your details to continue"

            FIELD UsernameInput
                LABEL "Email or Username"
                PLACEHOLDER "name@company.com"

            FIELD PasswordInput
                LABEL "Password"
                APPEND Icon (Visibility Toggle/Eye)

            ACTION LoginButton
                SET State = Active
                STYLE = Primary Color (Full Width)

            GROUP SecondaryActions
                LINK "Forgot Password?" (Right Aligned)
                FOOTER "Don't have an account? Sign Up"

END OBJECT

LOGIC: Interactions
ON HOVER LoginButton CHANGE BackgroundOpacity (0.9)

ON CLICK VisibilityToggle SWITCH PasswordField Type (Text <-> Password)

ON SUBMIT TRIGGER VerifyCredentials API Call