import React from "react";
import classNames from "classnames";
import styles from "./Button.module.css";

type ButtonProps = {
  variant?: "default" | "icon";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const Button = ({
  children,
  variant = "default",
  className,
  type = "button",
  ...rest
}: ButtonProps) => {
  const classMap = {
    default: styles.default,
    icon: styles.icon,
  };

  return (
    <button
      type={type}
      className={classNames(styles.botao, classMap[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
