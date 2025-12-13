import { useState } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { useNavigate } from "react-router";
import Logo from "../Log in/Logo";
import Img from "../Log in/Img";
import { useSignup } from "../../hooks/useSignup";

function RegisterForm() {
  // const navigate =
  useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signup, error, isLoading } = useSignup();

  async function handleSubmit(event) {
    event.preventDefault();

    await signup(name, email, password);
  }

  return (
    <div style={style.container}>
      <Logo />
      <Img />
      <h1 style={style.signIn}>Hello There!</h1>
      <div style={style.text}>Join to get started with EcoBin!</div>
      <Form style={style.form} onSubmit={handleSubmit}>
        <Form.Group controlId="name">
          <Form.Label style={style.label}>Name</Form.Label>
          <Form.Control
            type="text"
            placeholder="Name"
            style={style.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Form.Group>
        <Form.Group controlId="email">
          <Form.Label style={style.label}>Email</Form.Label>
          <Form.Control
            type="email"
            placeholder="username@gmail.com"
            style={style.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Form.Group>
        <Form.Group controlId="formGroupPassword">
          <Form.Label style={style.label}>Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="password"
            style={style.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Form.Group>
        <div style={style.buttonContainer}>
          <Button
            variant="primary"
            type="submit"
            style={style.button}
            disabled={isLoading}
          >
            Sign Up
          </Button>
        </div>
        {error && (
          <div style={{ color: "red", marginTop: "10px" }}>{error}</div>
        )}
      </Form>
    </div>
  );
}

const style = {
  container: {
    width: "500px",
    margin: "auto",
    marginTop: "150px",
    marginLeft: "650px",
  },
  form: {
    padding: "20px",
  },
  signIn: {
    color: "#20476b",
    fontWeight: "bold",
    fontSize: "32px",
    marginBottom: "16px",
  },
  text: {
    color: "#265b82ff",
    marginBottom: "32px",
  },

  label: {
    fontWeight: "bold",
    marginBottom: "10px",
    display: "block",
    borderRadius: "0px",
    //borderColor: "#20476b",
    color: "#20476b",
  },
  input: {
    width: "100%",
    padding: "8px",
    marginBottom: "16px",
    boxSizing: "border-box",
    borderRadius: "20px",
    borderColor: "#20476b",
  },
  buttonContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    width: "40%",
    backgroundColor: "#265b82ff",
    borderColor: "#20476b",
    marginTop: "20px",
    padding: "10px",
    borderRadius: "100px",
    display: "grid",
    placeItem: "center",
  },
};

export default RegisterForm;
